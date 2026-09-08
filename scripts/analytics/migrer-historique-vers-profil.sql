-- Base ANALYTICS — reprise de l'historique vers le modèle Profil (structure × dispositif).
-- À exécuter UNE FOIS, après le déploiement de l'API (migration
-- 20260906000000-profil-analytics-referentiels) et son dump nocturne, puis relancer
-- l'enrichissement (job 2) et le recalcul de la vue démarches IA.
--
-- Conversion, sans recalcul : la structure legacy (12 valeurs, plus MILO_PACEA posé par
-- l'ancien enrichissement) encodait déjà le dispositif, on le déduit ligne à ligne.
--   - événements : evenement_engagement et ses copies annuelles ;
--   - vues agrégées : maille dispositif ajoutée en place ;
--   - archive_jeune : mêmes règles que la migration de la base API (idempotent).
-- PASS_EMPLOI (support), INVITE et les conseillers MiLo ne sont pas touchés.
--
-- Coût maîtrisé : une seule passe par ligne (dispositif et structure dans le même UPDATE),
-- seules les lignes qui changent sont réécrites, par lots d'une semaine validés un par un,
-- index dispositif créé après coup. Interruptible et rejouable : une ligne convertie ne
-- correspond plus aux critères. Lancer hors de la chaîne nocturne (02h30 → fin du job 2),
-- sans BEGIN englobant (les COMMIT sont dans le script) :
--   psql "$DUMP_RESTORE_DB_TARGET" -v ON_ERROR_STOP=1 -f scripts/analytics/migrer-historique-vers-profil.sql
--
-- Pour dimensionner avant de lancer (volume de lignes à réécrire) :
--   SELECT structure, type_utilisateur, count(*) FROM evenement_engagement
--   WHERE structure NOT IN ('MILO', 'INVITE', 'PASS_EMPLOI') OR type_utilisateur = 'JEUNE'
--   GROUP BY 1, 2 ORDER BY 3 DESC;

CREATE OR REPLACE FUNCTION pg_temp.dispositif_depuis_structure_legacy(structure_legacy text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE structure_legacy
    WHEN 'POLE_EMPLOI'                THEN 'CEJ'
    WHEN 'POLE_EMPLOI_BRSA'           THEN 'BRSA'
    WHEN 'POLE_EMPLOI_AIJ'            THEN 'AIJ'
    WHEN 'AVENIR_PRO'                 THEN 'AVENIR_PRO'
    WHEN 'FT_ACCOMPAGNEMENT_INTENSIF' THEN 'ACCOMPAGNEMENT_INTENSIF'
    WHEN 'FT_ACCOMPAGNEMENT_GLOBAL'   THEN 'ACCOMPAGNEMENT_GLOBAL'
    WHEN 'FT_EQUIP_EMPLOI_RECRUT'     THEN 'EQUIP_EMPLOI_RECRUT'
    WHEN 'FT_DEMANDEUR_D_EMPLOI'      THEN 'DEMANDEUR_D_EMPLOI'
    WHEN 'FT_ESPACE_CANDIDAT'         THEN 'ESPACE_CANDIDAT'
    WHEN 'MILO_PACEA'                 THEN 'PACEA'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.structure_depuis_legacy(structure_legacy text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN structure_legacy = 'CONSEIL_DEPT' THEN 'CONSEIL_DEPARTEMENTAL'
    WHEN structure_legacy = 'MILO_PACEA'   THEN 'MILO'
    WHEN structure_legacy IN ('POLE_EMPLOI', 'POLE_EMPLOI_BRSA', 'POLE_EMPLOI_AIJ', 'AVENIR_PRO',
                              'FT_ACCOMPAGNEMENT_INTENSIF', 'FT_ACCOMPAGNEMENT_GLOBAL',
                              'FT_EQUIP_EMPLOI_RECRUT', 'FT_DEMANDEUR_D_EMPLOI', 'FT_ESPACE_CANDIDAT')
      THEN 'FRANCE_TRAVAIL'
    ELSE structure_legacy
  END
$$;

-- Une passe sur les lignes à convertir d'une semaine donnée (NULL = lignes pas encore enrichies).
-- Un jeune MiLo resté 'MILO' était en CEJ : l'ancien enrichissement relabellisait en
-- MILO_PACEA les jeunes PACEA.
CREATE OR REPLACE FUNCTION pg_temp.convertir_semaine(nom_table text, semaine_cible date)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  nb_lignes bigint;
BEGIN
  EXECUTE format($sql$
    UPDATE %I SET
      dispositif = CASE
        WHEN structure = 'MILO' AND type_utilisateur = 'JEUNE' THEN 'CEJ'
        ELSE COALESCE(dispositif, pg_temp.dispositif_depuis_structure_legacy(structure))
      END,
      structure = pg_temp.structure_depuis_legacy(structure)
    WHERE semaine IS NOT DISTINCT FROM $1
      AND (
        structure IN ('CONSEIL_DEPT', 'MILO_PACEA', 'POLE_EMPLOI', 'POLE_EMPLOI_BRSA',
                      'POLE_EMPLOI_AIJ', 'AVENIR_PRO', 'FT_ACCOMPAGNEMENT_INTENSIF',
                      'FT_ACCOMPAGNEMENT_GLOBAL', 'FT_EQUIP_EMPLOI_RECRUT',
                      'FT_DEMANDEUR_D_EMPLOI', 'FT_ESPACE_CANDIDAT')
        OR (structure = 'MILO' AND type_utilisateur = 'JEUNE' AND dispositif IS NULL)
      )
  $sql$, nom_table) USING semaine_cible;
  GET DIAGNOSTICS nb_lignes = ROW_COUNT;
  RETURN nb_lignes;
END
$$;

-- Tables portant structure, type_utilisateur et semaine : événements et vues agrégées.
DO $$
DECLARE
  nom_table text;
  semaine_cible date;
  semaines date[];
  nb_lignes bigint;
BEGIN
  FOREACH nom_table IN ARRAY ARRAY[
    'evenement_engagement_2022',
    'evenement_engagement_2023',
    'evenement_engagement_2024',
    'evenement_engagement',
    'analytics_fonctionnalites',
    'analytics_fonctionnalites_demarches_ia',
    'analytics_fonctionnalites_migration',
    'analytics_engagement',
    'analytics_engagement_national'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS dispositif varchar', nom_table);
    COMMIT;

    EXECUTE format(
      'SELECT array_agg(DISTINCT semaine ORDER BY semaine) FILTER (WHERE semaine IS NOT NULL) FROM %I',
      nom_table
    ) INTO semaines;
    FOREACH semaine_cible IN ARRAY COALESCE(semaines, ARRAY[]::date[]) LOOP
      nb_lignes := pg_temp.convertir_semaine(nom_table, semaine_cible);
      COMMIT;
      RAISE NOTICE '% — semaine % : % lignes converties', nom_table, semaine_cible, nb_lignes;
    END LOOP;

    nb_lignes := pg_temp.convertir_semaine(nom_table, NULL);
    COMMIT;
    RAISE NOTICE '% — sans semaine : % lignes converties', nom_table, nb_lignes;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (dispositif)',
                   nom_table || '_dispositif_index', nom_table);
    COMMIT;
  END LOOP;
END
$$;

-- Archive des jeunes (petite table) : mêmes règles que la migration de la base API.
UPDATE archive_jeune SET
  dispositif = CASE
    WHEN structure = 'MILO' AND dispositif IS NULL THEN 'CEJ'
    WHEN dispositif IS NULL OR dispositif = 'CONSEIL_DEPT'
      THEN pg_temp.dispositif_depuis_structure_legacy(structure)
    ELSE dispositif
  END,
  structure = pg_temp.structure_depuis_legacy(structure)
WHERE structure IS DISTINCT FROM pg_temp.structure_depuis_legacy(structure)
   OR dispositif IS NULL
   OR dispositif = 'CONSEIL_DEPT';

-- Contrôle : plus aucune valeur legacy ne doit rester.
SELECT 'evenement_engagement' AS table_verifiee, structure, dispositif, type_utilisateur, count(*)
FROM evenement_engagement GROUP BY 2, 3, 4
UNION ALL
SELECT 'analytics_fonctionnalites', structure, dispositif, type_utilisateur, count(*)
FROM analytics_fonctionnalites GROUP BY 2, 3, 4
UNION ALL
SELECT 'archive_jeune', structure, dispositif, NULL, count(*)
FROM archive_jeune GROUP BY 2, 3
ORDER BY 1, 2, 3, 4;

-- Récupérer l'espace des anciennes versions de lignes.
VACUUM ANALYZE evenement_engagement;

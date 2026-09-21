# Pipeline analytics

## Pourquoi cette pipeline ? Pour qui ?

Pour analyser l'usage de l'application, on ne requête **jamais** la base de production
directement : elle est transactionnelle (elle sert l'app mobile et le web conseiller en
temps réel) et on ne veut ni la ralentir, ni exposer ses données vivantes.

On alimente donc une **base Analytics séparée**, puis on construit dessus des tables de vues
agrégées (par semaine / structure / type d'utilisateur / géographie) que **Metabase** requête
pour les dashboards.

La pipeline fonctionne en mode **ELT** (Extract, Load, **puis** Transform) : on charge d'abord
les données brutes dans la base Analytics, et on transforme ensuite en SQL directement dans
cette base cible. Le "pourquoi ELT et pas ETL" (dump complet trop long, dashboards à garder
< 1 min) est détaillé dans [ADR-004](./decisions/ADR-004-pipeline-analytics.md).

## Vue d'ensemble

```
   BASE API (prod, transactionnelle)                BASE ANALYTICS (dédiée)
 ┌──────────────────────────────────┐            ┌──────────────────────────────────┐
 │  Tables métier                   │  ① DUMP    │  Tables métier (copie)           │
 │   jeune, action, rdv, ...        │ ─────────► │                                  │
 │                                  │            │  evenement_engagement            │
 │  evenement_engagement            │  ② COPY    │   ◄── chargement itératif        │
 │   ◄── EvenementService.creer()   │ ─────────► │        (batch, stream COPY)      │
 │       (1 ligne / acte usager)    │            │                                  │
 └──────────────────────────────────┘            │  ③ ENRICHIR : semaine, jour,     │
   SOURCE (DUMP_RESTORE_DB_SOURCE)               │      géographie (agence/dépt/rég)│
                                                  │                                  │
                                                  │  ④ VUES agrégées (chaque lundi)  │
                                                  │   analytics_fonctionnalites      │
                                                  │   analytics_engagement[_national]│
                                                  └─────────────────┬────────────────┘
                                                    TARGET (DUMP_RESTORE_DB_TARGET)
                                                                    │
                                                                    ▼
                                                            Metabase (dataviz)
```

> **Frontière de périmètre** : le repo `pass-emploi-api` s'arrête à la base Analytics et ses
> vues. La restitution (dashboards Metabase) et les indicateurs consolidés vivent en aval
> (voir `pass-emploi-analytics`). Chaque job remonte un `SuiviJob` (succès/échec, volumétrie,
> durée) : c'est le premier réflexe quand un chiffre Metabase paraît figé (cf.
> [investigation baisse RDV](./investigations/2026-05-11-baisse-rdv.md)).

## Comment analyser les données

- Les données à requêter sont dans la **base Analytics**, tables `analytics_fonctionnalites`
  et `analytics_engagement` (détaillées plus bas).
- Un **événement d'engagement (EE)** = une ligne écrite en prod à chaque acte utilisateur
  important, via `EvenementService.creer(...)` (`src/domain/evenement.ts`). C'est la matière
  première de tout le suivi d'usage.
- Les vues sont **agrégées à la semaine** : les analyses fines se font à cette maille.

## Fraîcheur des données

| Donnée | Mise à jour |
| --- | --- |
| Tables métier (dump) | Quotidien, après le cron 02h30 (job 0) |
| `analytics_population_membres`, `analytics_communication_destinataires`, `analytics_deploiement_membres` | Quotidien, après le dump (job 0bis) — statuts figés à `date_calcul` |
| `evenement_engagement` | Quotidien (jobs 0 → 1) |
| Colonnes enrichies (`semaine`, `jour`, géo) | Quotidien (job 2) |
| Vues `analytics_*` | **Chaque lundi** — agrégats de la **semaine précédente** (job 3) |

Les dashboards sur les vues agrégées reflètent donc la semaine précédente au plus tôt le lundi
matin ; la semaine en cours n'apparaît qu'au lundi suivant.

## Composition de la pipeline

Le dispositif analytics repose sur **deux familles de jobs** :

Les handlers portent un bloc JSDoc (étape, liens de chaîne, tables, `@see` vers cette
page). Ce n'est **pas** du runtime : convention documentée dans
[ADR-005](./decisions/ADR-005-analytics-doc-metadata.md).

### Pipeline quotidienne

Quatre jobs s'enchaînent automatiquement chaque nuit (voir [Ordonnancement](#ordonnancement)) :

1. [0-dump-for-analytics.job.ts](../src/application/jobs/analytics/0-dump-for-analytics.job.ts) — copie des tables métier prod → analytics
2. [0bis-charger-les-populations.job.ts](../src/application/jobs/analytics/0bis-charger-les-populations.job.ts) — populations, communications et déploiements résolus par utilisateur pour Metabase, en parallèle du job 1
3. [1-charger-les-evenements.job.ts](../src/application/jobs/analytics/1-charger-les-evenements.job.ts) — chargement des événements d'engagement
4. [2-enrichir-les-evenements.job.ts](../src/application/jobs/analytics/2-enrichir-les-evenements.job.ts) — enrichissement (semaine, jour, géographie)
5. [3-charger-les-vues.job.ts](../src/application/jobs/analytics/3-charger-les-vues.job.ts) — agrégation des vues de la semaine précédente (le lundi)

### Maintenance — reprise de l'historique vers le modèle Profil (septembre 2026)

Les événements et toutes les vues capturent désormais `structure` (MILO, FRANCE_TRAVAIL,
CONSEIL_DEPARTEMENTAL, INVITE) **et** `dispositif` (CEJ, PACEA, BRSA, AIJ, AVENIR_PRO, ...).
L'ancienne structure à 12 valeurs (`POLE_EMPLOI_BRSA`, `MILO_PACEA`, ...) n'est plus produite.
Les tables métier recopiées par le dump sont converties par la migration Sequelize de l'API.
L'historique de `evenement_engagement`, ses copies annuelles et les vues `analytics_*`, eux,
ne vivent qu'en analytics : ils se reprennent une fois, **en place et sans recalcul**, avec
[scripts/analytics/migrer-historique-vers-profil.sql](../scripts/analytics/migrer-historique-vers-profil.sql),
puis un run du job 2 (`TASK_NAME=ENRICHIR_EVENEMENTS_ANALYTICS`) qui reconstruit
`evenement_engagement_jeune`, et enfin `yarn tasks:initialiser-la-vue-demarches-ia` qui
recalcule la vue démarches IA avec sa règle avant / après généralisation. Ne pas relancer
`initialiser-les-vues` pour cette reprise : l'ancienne structure encodait déjà le dispositif,
la conversion ligne à ligne donne le même résultat qu'un recalcul, et un recalcul de la vue
`migration` utiliserait les feature flips d'aujourd'hui, pas la population pilote de l'époque.

### Maintenance — recalcul des vues

Pour reconstruire les vues agrégées sur l'historique — évolution des actes d'engagement, ajout
d'une nouvelle vue, correction de données — deux jobs sont lancés **à la demande** via task
Scalingo :

- [initialiser-les-vues.job.ts](../src/application/jobs/analytics/initialiser-les-vues.job.ts) — tout l'historique
- [initialiser-les-vues-derniere-annee.job.ts](../src/application/jobs/analytics/initialiser-les-vues-derniere-annee.job.ts) — dernière année

## Ordonnancement

- Le premier job de la pipeline (`0-dump-for-analytics`) est lancé via un **cron** dans le worker, **tous les jours à 02h30** (`DUMP_ANALYTICS = '30 2 * * *'`, voir `src/domain/planificateur.ts`).
- A l'issue du job, deux jobs sont créés dans le worker : charger les événements (job 1, qui enchaîne la suite) et charger les populations (job 0bis, indépendant).
- A l'issue du job, un nouveau job est créé dans le worker pour l'étape enrichir les événements.
- Lorsque le jour de la semaine est un **lundi**, un nouveau job est créé dans le worker pour l'étape charger les vues.

## Reprise en cas d'échec

Quand un chiffre Metabase paraît figé : consulter d'abord les `SuiviJob` (succès/échec,
volumétrie, durée). Si un job a **levé une exception** (ex. job 1), aucun `SuiviJob` n'est
enregistré — regarder les logs / APM. Voir aussi
[investigation baisse RDV](./investigations/2026-05-11-baisse-rdv.md).

Seul le cron démarre le job 0 ; la suite est enfilée via `ajouterJob`. Pas de retry Bull
automatique (`attempts: 1`). Si le job 1 ou 2 échoue **avant** d'enfiler la suite, l'étape
suivante ne part pas.

Note : le job 0 enfile quand même le job 1 même si le dump remonte une erreur (`stderr`) —
vérifier le `SuiviJob` du dump avant de faire confiance à la suite.

| Situation | Comportement | Piste de reprise |
| --- | --- | --- |
| Job 1 échoue (chargement EE) | Job 2 (et job 3 le lundi) non enfilés | Relancer via `TASK_NAME=CHARGER_EVENEMENTS_ANALYTICS` ; chargement **incrémental**, un run ultérieur rattrape les EE manquants |
| Job 2 échoue un **lundi** | Job 3 non enfilé | Relancer via `TASK_NAME=ENRICHIR_EVENEMENTS_ANALYTICS` ; les lignes restent avec `semaine is null` jusqu'à un enrichissement réussi, puis enfiler / relancer les vues si besoin |
| Job 0bis échoue (populations) | Les trois tables `analytics_population_membres` / `analytics_communication_destinataires` / `analytics_deploiement_membres` gardent le contenu de la veille (rebuild transactionnel) | Relancer via `yarn tasks:charger-populations` |
| Job 3 manqué / échoué (vues) | Vues `analytics_*` non mises à jour pour la semaine | Relancer via `TASK_NAME=CHARGER_LES_VUES_ANALYTICS` (semaine précédente), ou `yarn tasks:initialiser-les-vues` / variante dernière année pour un recalcul large |

Le run quotidien suivant repart du cron (job 0) : utile pour rattraper les EE, mais **ne
recalcule pas** automatiquement une semaine de vues déjà manquée (job 3 = lundi uniquement).

## Que font les jobs ?

### 0-dump-for-analytics.job.ts

Copie de la base prod vers analytics via `pg_dump` / `pg_restore`, en excluant les tables de logs et d'événements d'engagement.

### 0-dump-pilotage-for-analytics.job.ts

Hors cron. Dump partiel des six tables de pilotage (`DUMP_TABLES` dans
`0_db_dump_restore.sh`), puis enfile le job 0bis. Voir « Rafraîchir avant l'heure » sous
0bis.

### 0bis-charger-les-populations.job.ts

Matérialise, pour Metabase, ce que les fonctionnalités calculent pour **un** utilisateur,
mais de façon **exhaustive** — trois tables, reconstruites à chaque run (`DELETE` + `INSERT`
dans une transaction, `date_calcul` identique sur toutes les lignes) :

| Table | Une ligne par | Colonnes propres | `statut` (figé à `date_calcul`) |
| --- | --- | --- | --- |
| `analytics_population_membres` | (population, conseiller ou jeune) | `email_conseiller_reference`, `type_conseiller_reference` (`ACTUEL` / `INITIAL` si transfert temporaire) | — |
| `analytics_communication_destinataires` | (communication, conseiller destinataire) | `destinataire`, `type`, `titre`, `contenu`, `date_debut`, `date_fin` | `PASSEE` / `EN_COURS` / `PREVUE` |
| `analytics_deploiement_membres` | (déploiement, conseiller concerné) | `nature`, `id_fonctionnalite`, `date_activation` | `PREVU` / `ACTIF` |

Toutes portent l'identité de l'utilisateur (`email`, `nom`, `prenom`), son profil (`structure`,
`dispositif`) et son lieu d'accompagnement (`agence` : structure MiLo ou agence FT).
Jeunes : uniquement dans `analytics_population_membres` pour l'instant.

**Pourquoi c'est la vérité.** Le job ne réécrit aucune règle métier : appartenance à une
population, destinataires d'une communication, conseillers concernés par un déploiement et
prédicats temporels sont les fragments de
[`sql-helpers.ts`](../src/infrastructure/repositories/sql-helpers.ts), ceux-là mêmes
qu'utilisent `CommunicationSqlRepository`, `MigrationSqlRepository` et
`PopulationSqlRepository` en production. Si une règle change dans un repository, la table
suit au déploiement suivant. Le test du job le vérifie en croisant la table avec ce que
ces repositories renvoient pour un conseiller donné.

**Fraîcheur.** Les statuts sont calculés à `date_calcul` (J-1, ~3h du matin) : une
communication qui démarre à 10h reste `PREVUE` jusqu'au run suivant. Toujours afficher
`date_calcul` (ou « prévue le … ») à côté du statut pour que ce décalage soit lisible.
Côté Metabase, **ne jamais recalculer un statut avec `now()`** : filtrer sur la colonne.

Requêtes de départ pour les questions Metabase :

```sql
-- Populations avec leurs conseillers
SELECT id_population, email, nom, prenom, structure, dispositif, agence, date_calcul
FROM analytics_population_membres
WHERE type_utilisateur = 'CONSEILLER'
ORDER BY id_population, nom, prenom;

-- Communications prévues (ou passées : statut = 'PASSEE'), groupées par population et date
SELECT id_communication, id_population, titre, type, date_debut, date_fin,
       count(*) AS nb_conseillers, max(date_calcul) AS calcule_le
FROM analytics_communication_destinataires
WHERE statut = 'PREVUE'
GROUP BY id_communication, id_population, titre, type, date_debut, date_fin
ORDER BY date_debut;

-- Détail d'une communication : contenu affiché au conseiller + ses destinataires (filtre Metabase {{id_communication}})
SELECT titre, contenu, date_debut, date_fin, statut
FROM analytics_communication_destinataires
WHERE id_communication = {{id_communication}}
LIMIT 1;

SELECT email, nom, prenom, structure, dispositif, agence
FROM analytics_communication_destinataires
WHERE id_communication = {{id_communication}}
ORDER BY nom, prenom;

-- Migrations prévues, avec les conseillers
SELECT id_deploiement, id_population, date_activation, email, nom, prenom, agence
FROM analytics_deploiement_membres
WHERE nature = 'MIGRATION' AND statut = 'PREVU'
ORDER BY date_activation, nom, prenom;

-- Fonctionnalités actives, effectifs par fonctionnalité et population
SELECT id_fonctionnalite, id_population, date_activation, count(*) AS nb_conseillers
FROM analytics_deploiement_membres
WHERE nature = 'FONCTIONNALITE' AND statut = 'ACTIF'
GROUP BY id_fonctionnalite, id_population, date_activation
ORDER BY id_fonctionnalite, date_activation;
```

**Rafraîchir avant l'heure.** Le job lit les tables **dumpées** ; pour voir l'effet d'une
population, communication ou déploiement modifié dans la journée, il faut d'abord
rafraîchir ces tables. Une `tasks:*` **enfile** le job dans le worker (rien ne s'exécute dans
le terminal) ; suivre l'avancement dans les `SuiviJob`.

| Besoin | Commande | Durée | Ce qui est rafraîchi |
| --- | --- | --- | --- |
| Voir l'effet d'une population / communication / déploiement | `scalingo --app pass-emploi-api-prod run yarn tasks:dump-pilotage` | secondes | les 6 tables de pilotage (`population*`, `communication`, `deploiement`, `fonctionnalite`), puis 0bis enfilé automatiquement. Conseillers, jeunes, agences restent à J-1 |
| Tout à jour, y compris agences / structures des conseillers | `scalingo --app pass-emploi-api-prod run yarn tasks:dump-analytics` | > 20 min, dashboards incohérents pendant la restauration | toute la base, puis 0bis (et le job 1) enfilés |
| Recalculer sans re-dumper (code du job changé) | `scalingo --app pass-emploi-api-prod run yarn tasks:charger-populations` | secondes | rien : recalcul sur l'existant |

Le dump partiel est possible parce que les tables de pilotage ne sont référencées par
aucune autre table ; `conseiller` et `jeune`, référencés partout (actions, RDV…), ne
peuvent pas être restaurés seuls avec `pg_restore --clean`.

### 1-charger-les-evenements.job.ts

Chargement incrémental depuis `evenement_engagement_hebdo` (prod) : événements dont
`date_evenement` est postérieure au dernier déjà chargé en analytics.
Technique utilisée : COPY FROM / TO PostgreSQL via un stream Node (batch de 150 000 lignes).

### 2-enrichir-les-evenements.job.ts

Afin de faciliter l'exploratoire et le reporting, le job enrichit les événements **non encore
enrichis** (`semaine is null` — en pratique, ceux chargés par le job 1 et pas encore enrichis).

1. Mise à jour du schéma analytics (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
2. Enrichissement : semaine, jour, agence / département / région

Les champs enrichis sur `evenement_engagement` :

- `semaine` — maille d'analyse principale
- `jour` — notion d'utilisateur actif (vue engagement)
- `agence` / `departement` / `region` — analyses géographiques

#### Ajouter un champ enrichi

Le schéma analytics n'a pas de migration Sequelize dédiée : les évolutions passent par
`2-enrichir-les-evenements.job.ts` (`mettreAJourLeSchema`, `indexerLesColonnes`, puis la
requête d'enrichissement).

1. **`mettreAJourLeSchema`** — `ADD COLUMN IF NOT EXISTS` sur la table concernée
2. **`indexerLesColonnes`** — `create index if not exists` si le champ sera filtré ou joint
3. **Requête d'enrichissement** — cibler les lignes non enrichies (`where semaine is null`,
   ou la colonne équivalente pour le nouveau champ)
4. **Déployer** — au prochain run nocturne, le schéma est appliqué et les nouveaux EE sont enrichis

Pour **backfill sur l'historique** déjà enrichi (`semaine` renseigné), prévoir une requête
dédiée ou un run manuel : le job quotidien ne retraite pas ces lignes.

### 3-charger-les-vues.job.ts

Afin d'avoir des dashboards qui répondent vite, on fait des calculs d'indicateurs agrégés par Semaine/Structure/Type d'utilisateur/Géographie

- mise à jour des schémas des tables pour l'analytics
- chargement des données de la semaine précédente

**_analytics_fonctionnalites_**
Détaille l'utilisation des fonctionnalités aux mailles :

- categorie-action-nom-structure-dispositif-type-utilisateur-semaine
- categorie-action-structure-dispositif-type-utilisateur-semaine
- categorie-structure-dispositif-type-utilisateur-semaine

Pour cette maille les indicateurs suivants sont calculés :

- nombre d'EE
- nombre d'utilisateurs

**_analytics_fonctionnalites_demarches_ia_**
Même chose que **_analytics_fonctionnalites_**, restreint aux bénéficiaires. Avant la
généralisation des démarches IA (`DATE_GENERALISATION_DEMARCHES_IA`, 2026-04-01), seuls les
bêta-testeurs comptent : bénéficiaires des conseillers porteurs du feature flip `DEMARCHES_IA`,
bénéficiaires transférés depuis ces conseillers, et bénéficiaires ayant utilisé une
fonctionnalité IA dans la semaine. Depuis, tous les bénéficiaires sans exception.
Recalcul de cette seule vue sur tout l'historique : `yarn tasks:initialiser-la-vue-demarches-ia`.

**_analytics_fonctionnalites_migration_**
Même chose que **_analytics_fonctionnalites_** (mêmes mailles et indicateurs), filtré sur les
utilisateurs liés à une migration :

- conseillers dont un `feature_flip.feature_tag` contient `migration`
- jeunes présents dans `archive_jeune` avec un `motif` contenant `migration`

(voir `3-1bis-vue-fonctionnalites-migration.ts`).

**_analytics_engagement_**
Détaille l'engagement des utilisateurs aux mailles :

- structure-dispositif-type_utilisateur-semaine-departement-region

Pour cette maille les indicateurs suivants sont calculés :

- nombre d'utilisateurs ayant au moins un événement dans les deux derniers mois
- nombre d'utilisateurs ayant au moins 2 événements dans la semaine (**actif**)
- nombre d'utilisateurs ayant été actifs au moins 3 semaines sur les 6 dernières semaines
- nombre d'utilisateurs ayant été actifs au moins 4 semaines sur les 6 dernières semaines

**_analytics_engagement_national_**
Détaille l'engagement des utilisateurs aux mailles :

- structure-dispositif-type_utilisateur-semaine
  Le retrait des niveaux departement-region permet d'avoir des chiffres exacts à l'échelle nationale.

Les indicateurs sont les mêmes que pour la table analytics_engagement

### initialiser-les-vues.job.ts

Si vous avez besoin de recalculer les vues analytics dans le passé (suite à une mise à jour d'actes d'engagement ou de création de nouvelles vues), vous pouvez relancer les calculs via une task Scalingo

```
scalingo --region osc-fr1 --app pass-emploi-api-staging run yarn tasks:initialiser-les-vues
```

[Une variante existe pour relancer uniquement les calculs sur la dernière année.](../src/application/jobs/analytics/initialiser-les-vues-derniere-annee.job.ts)

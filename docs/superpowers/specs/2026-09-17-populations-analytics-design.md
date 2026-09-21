# Populations résolues dans la base Analytics (Metabase)

> Design validé le 2026-09-17. Plan d'implémentation :
> [`../plans/2026-09-17-populations-analytics.md`](../plans/2026-09-17-populations-analytics.md).

## Problème

Le support et le métier veulent visualiser, sans passer par Swagger : les populations,
les conseillers et jeunes qu'elles résolvent, les déploiements et les communications à
venir par population. Le même écran doit servir de **dry-run** avant un envoi massif ou
une migration : la liste affichée doit être exactement celle que le code de l'API
calculera — la logique de résolution (`sqlConseillerDansPopulation`,
`sqlJeuneDansPopulation` dans `src/infrastructure/repositories/sql-helpers.ts`) ne doit
exister qu'à un seul endroit.

## Décision

Metabase (`stats.pass-emploi.beta.gouv.fr`, déjà branché sur la base Analytics) lit une
table **`analytics_population_membres`** reconstruite chaque nuit par un nouveau job de la
pipeline analytics. Ce job **n'implémente pas lui-même** la logique d'appartenance : il
instancie `PopulationSqlRepository` — la classe de production utilisée par
`NotifierBeneficiairesJobHandler` pour décider qui reçoit une notification ou une
communication — pointée sur la connexion Analytics, et appelle ses méthodes
`getIdsDesJeunesParProfilOuConseillerCite` / `getIdsDesConseillersParProfilOuConseillerCite`
pour chaque population. Le job ne réimplémente que l'enrichissement présentation
(email, nom, prénom, agence), qui ne porte aucun prédicat métier.

Ce chemin est la vraie source de vérité côté jeunes : `NOTIFIER_COMMUNICATIONS` enfile
`NOTIFIER_BENEFICIAIRES` avec `idPopulation`, qui appelle exactement cette méthode
(`notifier-beneficiaires.job.handler.db.ts:212`). Côté conseillers, aucune fonctionnalité
de production n'a besoin de lister tous les conseillers d'une population aujourd'hui —
`sqlConseillerDansPopulation` n'existe qu'en prédicat inline (migrations, rebasculement
d'orphelins). La méthode `getIdsDesConseillersParProfilOuConseillerCite` est donc une
**extension du domaine `Population`**, symétrique de celle des jeunes (le commentaire de
`population.ts` décrit déjà les deux règles), pas un raccourci propre à l'analytics :
une future fonctionnalité conseiller la réutiliserait telle quelle.

Conséquence : si la règle de résolution change dans `population.repository.db.ts`
(cas particulier ajouté, correction de bug), le job analytics suit automatiquement au
déploiement suivant, sans y toucher — la garantie de vérité tient par construction, pas
par discipline de maintenance.

Compromis assumé : une paire de requêtes par population (au lieu d'un `UNION ALL` global)
— les populations sont créées à la main via `/support` pour des campagnes ciblées
(quelques dizaines au plus), le coût est négligeable.

Fraîcheur acceptée : **J-1** (dump à 2h30). Rafraîchissement à la demande possible en
deux temps : `yarn tasks:dump-analytics` (re-dump complet, > 20 min) puis
`yarn tasks:charger-populations`.

Écarté : requêtes SQL recopiées dans Metabase (divergence), vue Postgres en prod
(`pg_restore --clean` droppe les tables sans `CASCADE`, une vue dépendante casserait la
restauration), route API de prévisualisation (exacte et temps réel mais illisible pour le
métier — à reconsidérer si le besoin de temps réel apparaît, elle réutiliserait le même
repository).

## Extension du domaine `Population`

`src/domain/population.ts` : ajout de `getIdsDesConseillersParProfilOuConseillerCite(idPopulation): Promise<string[]>`
à `Population.Repository`, implémentée dans `PopulationSqlRepository` avec
`sqlConseillerDansPopulation` (le prédicat déjà utilisé partout ailleurs pour un conseiller).
Testée dans `test/infrastructure/repositories/population.repository.db.test.ts`, à côté de
la méthode jeune existante et avec les mêmes fixtures.

## Table `analytics_population_membres`

Une ligne par (population, membre). Pensée pour être lue telle quelle par le métier :
identité, profil, lieu d'accompagnement, et pour un jeune le conseiller par lequel il
est rattaché à la population.

| Colonne | Type | Contenu |
| --- | --- | --- |
| `id_population` | varchar | `population.id` |
| `type_utilisateur` | varchar | `CONSEILLER` ou `JEUNE` |
| `id_utilisateur` | varchar | `conseiller.id` ou `jeune.id` (pour les jointures) |
| `email` | varchar | email du conseiller / du jeune |
| `nom` | varchar | |
| `prenom` | varchar | |
| `structure` | varchar | profil de l'utilisateur (modèle Profil) |
| `dispositif` | varchar | profil de l'utilisateur, nullable |
| `agence` | varchar | lieu d'accompagnement : structure MiLo (`structure_milo.nom_officiel`) ou agence FT (`agence.nom_agence`), via l'utilisateur lui-même sinon via son conseiller de référence |
| `email_conseiller_reference` | varchar | jeune uniquement : email du conseiller de référence, celui par lequel le jeune est rattaché s'il est cité dans la population |
| `type_conseiller_reference` | varchar | jeune uniquement : `ACTUEL`, ou `INITIAL` quand un transfert temporaire est en cours (le conseiller de référence est alors l'initial, pas le temporaire) |
| `date_calcul` | timestamptz | horodatage du run, identique sur toutes les lignes |

Index sur `id_population`. Pas d'historique : la table est vidée puis remplie à chaque
run, dans une transaction (Metabase ne voit jamais une table à moitié remplie).

Règles d'appartenance (inchangées, portées par les helpers) :

- un **conseiller** est dans la population s'il est cité par email **ou** si son profil
  structure × dispositif correspond ;
- un **jeune** est dans la population si son conseiller de référence est cité par email
  **ou** si son propre profil correspond ;
- un profil de population sans dispositif couvre toute la structure.

## Communications et déploiements à venir

Lus **directement** dans les tables dumpées, sans job : `communication` (`date_debut >
now()`, ou en cours : `date_debut <= now() AND (date_fin IS NULL OR date_fin > now())`)
et `deploiement` (`date_activation > now()`), joints à `population` et aux compteurs de
`analytics_population_membres`. Les requêtes Metabase de départ sont données dans
`docs/ANALYTICS.md`.

## Job `CHARGER_POPULATIONS_ANALYTICS`

- Handler `src/application/jobs/analytics/0bis-charger-les-populations.job.ts`, enfilé par
  le job 0 (`DUMP_ANALYTICS`) juste après le dump, en parallèle du job 1 : il ne dépend
  que des tables dumpées, pas des événements d'engagement.
- Pour chaque `id` de `population` : instancie `new PopulationSqlRepository(connexionAnalytics)`
  et appelle `getIdsDesJeunesParProfilOuConseillerCite` / `getIdsDesConseillersParProfilOuConseillerCite`
  — la résolution d'appartenance passe par la classe de production, pas par une requête
  réécrite dans le job. L'enrichissement (email, nom, prénom, structure, dispositif,
  agence, conseiller de référence du jeune) est un `SELECT ... WHERE id = ANY(:ids)` sans
  logique métier.
- `SuiviJob` avec `resultat: { nbPopulations, nbConseillers, nbJeunes }`.
- Task Scalingo `yarn tasks:charger-populations` (`TASK_NAME=CHARGER_POPULATIONS_ANALYTICS`).
- Schéma créé par le job lui-même (`CREATE TABLE IF NOT EXISTS`, comme `3-0-migrate-schema.ts`).

## Tests

- Test DB du job : mêmes fixtures que `test/infrastructure/repositories/population.repository.db.test.ts`
  (conseiller cité, conseiller FT×CEJ par profil, jeune transféré, jeune BRSA chez un
  conseiller CEJ…), attendu : `conseillerCite`, `conseillerFtCej` côté conseillers ;
  `jeuneCite`, `jeuneTransfere`, `jeuneFtCej`, `jeuneCejChezHors` côté jeunes, avec
  `type_conseiller_reference = 'INITIAL'` pour le jeune transféré. Le parallèle avec le
  test du dépôt rend la cohérence visible. Une structure MiLo et une agence FT posées
  pour vérifier la colonne `agence` dans les deux cas.
- Test unitaire du job 0 : le job `CHARGER_POPULATIONS_ANALYTICS` est enfilé après le dump.

## Doc

`docs/ANALYTICS.md` : nouvelle étape quotidienne, ligne dans « Fraîcheur des données »,
section « Que font les jobs ? », ligne dans « Reprise en cas d'échec », procédure de
rafraîchissement à la demande. JSDoc `@analytics.*` sur le handler (ADR-005).

## Hors périmètre

Le dashboard Metabase lui-même (côté `stats`, non versionné — statu quo du projet) ;
seules les requêtes SQL de départ sont documentées. Historique des membres par date d'envoi. Route API de prévisualisation.

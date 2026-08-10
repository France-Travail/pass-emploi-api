# WIP — Séparer `ConfigurationApplication` (Jeune / Invité)

> Document de travail, à supprimer une fois le refacto appliqué. Ne pas le laisser
> traîner dans le repo au-delà de son exécution.

## Contexte

`Jeune.ConfigurationApplication` est un seul type de domaine partagé entre deux
agrégats distincts — `Jeune` (standard) et `JeuneInvite` — via une Factory unique
(`ConfigurationApplication.Factory.mettreAJour`) et une interface `Repository`
générique implémentée par deux classes différentes
(`JeuneConfigurationApplicationSqlRepository` et
`JeuneInviteConfigurationApplicationSqlRepository`).

Le repository est déjà correctement séparé par agrégat (Strategy appliqué dans
`UpdateJeuneConfigurationApplicationCommandHandler` via `estUnInvite`), mais le
Value Object qui traverse cette frontière ne l'est pas. Résultat observé deux fois
sur la branche `feat/job-purge-invite` :

- `dateDerniereActivite` est calculée par la Factory pour tout le monde mais
  silencieusement ignorée par `JeuneConfigurationApplicationSqlRepository.save`
  (pas de colonne sur `JeuneSqlModel`) — TODO déjà posé en attendant ce refacto.
- `dateDerniereActualisationToken` n'a aucun usage réel côté invité (le job de
  purge ne s'appuie que sur `dateDerniereActivite`) mais continue d'être
  persistée/lue pour les invités uniquement parce que le type est partagé.

C'est un cas de DRY appliqué à une ressemblance accidentelle plutôt qu'essentielle
(cf. discussion — ISP violé : rien n'empêche `save()` de recevoir un champ qu'il
ne sait pas honorer). Le fix : séparer le type au même endroit où le repository
est déjà séparé.

## Objectif

1. Deux types de configuration distincts (avec un socle commun), un par agrégat.
2. Suppression complète de `dateDerniereActualisationToken` côté invité (colonne,
   repository, Factory, tests) — il ne sert à rien pour ce profil aujourd'hui.
3. Plus aucune possibilité, au niveau du compilateur, qu'un champ propre à un
   agrégat soit silencieusement droppé par le repository de l'autre.

## Non-objectifs

- Ne pas ajouter la persistance de `dateDerniereActivite` pour les jeunes
  standards — reste un TODO assumé, hors scope ici.
- Ne pas toucher au job de purge (`purger-invites-inactifs.job.handler.db.ts`)
  ni à ses garde-fous — traité séparément.

## Design cible

```typescript
// src/domain/jeune/configuration-application.ts
interface ConfigurationApplicationCommune {
  idJeune: string
  pushNotificationToken?: string
  appVersion?: string
  installationId?: string
  instanceId?: string
  fuseauHoraire: string
}

interface ConfigurationApplicationJeune extends ConfigurationApplicationCommune {
  dateDerniereActualisationToken?: Date
  preferences?: ConfigurationApplication.Preferences
}

interface ConfigurationApplicationInvite extends ConfigurationApplicationCommune {
  dateDerniereActivite?: Date
}
```

`Repository` devient générique :

```typescript
interface Repository<T> {
  get(idJeune: string): Promise<T | undefined>
  save(configurationApplication: T): Promise<void>
}
```

Deux fonctions de mise à jour distinctes plutôt qu'une Factory unique paramétrée
(pas besoin d'over-engineering ici, la logique par champ est courte) :
- `mettreAJourConfigurationJeune`
- `mettreAJourConfigurationInvite`

Chacune ne connaît que les champs de son propre type — impossible de calculer
`dateDerniereActivite` pour un jeune standard, impossible de calculer
`dateDerniereActualisationToken` pour un invité.

## Plan d'exécution

### 1. Domaine — `src/domain/jeune/configuration-application.ts`
- Extraire `ConfigurationApplicationCommune`.
- Définir `ConfigurationApplicationJeune` et `ConfigurationApplicationInvite`.
- Remplacer `Factory.mettreAJour` par deux fonctions dédiées (ou deux méthodes
  sur deux Factory distinctes si on préfère garder l'injection Nest telle
  quelle — à trancher à l'implémentation selon ce qui reste le plus lisible).
- Retirer le TODO posé sur `dateDerniereActivite` (devient sans objet : le champ
  n'existe plus que sur `ConfigurationApplicationInvite`).

### 2. `src/domain/jeune/jeune.ts`
- `configuration: Jeune.ConfigurationApplication` → `configuration: ConfigurationApplicationJeune`.
- Adapter le re-export `Jeune.ConfigurationApplication` en conséquence (ou le
  supprimer si plus personne n'en a besoin après renommage — vérifier les ~10
  fichiers qui importent `Jeune.ConfigurationApplication` aujourd'hui, listés
  ci-dessous).

### 3. `src/domain/jeune/jeune-invite.ts`
- Ajouter le token/l'interface `Repository<ConfigurationApplicationInvite>`
  dédié si besoin (actuellement `JeuneInviteConfigurationApplicationRepositoryToken`
  existe déjà côté DI, seul le typage change).

### 4. Repositories
- `jeune-configuration-application-sql.repository.db.ts` : type sur
  `ConfigurationApplicationJeune`, aucun changement de champs persistés.
- `jeune-invite-configuration-application-sql.repository.db.ts` : type sur
  `ConfigurationApplicationInvite`, **retirer** `dateDerniereActualisationToken`
  de `attributesConfigurationApplication`, `save()`, `toConfigurationApplication()`.

### 5. `src/infrastructure/sequelize/models/jeune-invite.sql-model.ts`
- Retirer la colonne `dateDerniereActualisationToken`.

### 6. `src/infrastructure/repositories/authentification-sql.repository.db.ts`
- `creerJeuneInvite` : retirer `dateDerniereActualisationToken: null` de l'objet
  passé à `JeuneInviteSqlModel.creer`.

### 7. Migration
- Nouvelle migration : `removeColumn('jeune_invite', 'date_derniere_actualisation_token')`
  (+ `down` qui la recrée en `allowNull: true`, cohérent avec les migrations
  existantes du module).

### 8. `update-jeune-configuration-application.command.handler.ts`
- Brancher explicitement sur les deux fonctions de mise à jour dédiées plutôt
  que d'appeler une Factory générique — la duplication du `if (estUnInvite)`
  est acceptable et rend la divergence des deux profils visible plutôt que
  masquée par une abstraction commune.

### 9. Tests à mettre à jour
- `test/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.test.ts`
  — retirer toutes les assertions sur `dateDerniereActualisationToken`.
- `test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts`
  — retirer le cas `'inactif-malgre-token-recent'` (n'a plus de sens sans la
  colonne) sauf si on veut le garder comme régression sur "un champ qui n'existe
  plus ne doit influencer personne" — probablement à supprimer, redondant une
  fois la colonne partie.
- `test/fixtures/sql-models/jeune-invite.sql-model.ts` — retirer le champ du
  fixture.
- `test/application/commands/update-jeune-configuration-application.command.handler.test.ts`
  — adapter aux deux fonctions dédiées, retirer les assertions invité sur
  `dateDerniereActualisationToken`.
- `test/fixtures/jeune-configuration-application.fixture.ts` /
  `test/fixtures/jeune.fixture.ts` — vérifier qu'ils ciblent bien
  `ConfigurationApplicationJeune` après renommage (ne devraient pas changer de
  contenu, juste de type sous-jacent).

### 10. Fichiers à vérifier sans changement de fond attendu (juste compilation)
Consommateurs de `Jeune.ConfigurationApplication` côté jeune standard
uniquement — ne touchent jamais l'invité, devraient compiler tels quels une
fois le renommage de type propagé :
- `src/application/commands/action/add-commentaire-action.command.handler.ts`
- `src/application/jobs/notifier-recherches-offre-emploi.job.handler.ts`
- `src/application/jobs/notifier-rappel-action.job.handler.ts`
- `src/application/jobs/notifier-recherches-service-civique.job.handler.ts`
- `src/application/commands/notifier-nouvelles-immersions.command.handler.ts`
- `src/infrastructure/repositories/mappers/rendez-vous.mappers.ts`
- `src/infrastructure/repositories/mappers/jeunes.mappers.ts`
- `src/domain/notification/notification.ts`
- `src/app.module.ts` (bindings DI, à vérifier si les tokens génériques ont
  besoin d'un paramètre de type explicite)

### 11. Vérification
- `yarn tsc --noEmit` (pas de build : ne typecheck pas les tests, cf. convention
  du repo) doit passer sans erreur — le split doit faire apparaître toute
  fuite oubliée entre les deux types au niveau du compilateur, c'est tout
  l'intérêt du refacto.
- `yarn test:local:unit` et `yarn test:local:db` sur les fichiers listés en 9.
- `yarn lint`.

## Une fois appliqué

Supprimer ce fichier (`docs/wip-refacto-configuration-application.md`).

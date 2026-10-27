# Pass Emploi API

> Backend API du projet Pass Emploi (NestJS). Versions : `package.json` et `.nvmrc`. Toujours `yarn`.

@../pass-emploi-tools/docs/CONTEXTE-TRANSVERSE.md

---

## Vérifications après modification

| Vérification | Commande                                                         |
|--------------|------------------------------------------------------------------|
| Typecheck    | `yarn tsc --noEmit` (`yarn build` ne typecheck pas `test/`)      |
| Lint         | `yarn lint` / `yarn lint:fix`                                    |
| Tests unit   | `yarn test:local:unit`                                           |
| Tests DB     | `yarn test:local:db` (démarre les DB de test Docker)             |
| Un fichier   | `TZ=UTC ENVIRONMENT=test yarn mocha test/chemin/fichier.test.ts` |

Depuis un worktree, `yarn test:local:db` échoue : les conteneurs de test (`pgtestdb`,
`redistestdb`) appartiennent au checkout principal. Les lancer depuis celui-ci, puis
`TZ=UTC ENVIRONMENT=test DATABASE_URL=postgresql://test:test@localhost:56432/test REDIS_URL=redis://localhost:6767 yarn mocha 'test/**/*.db.test.ts' --exit --timeout 10000`

Pas de scan sécurité local : il ne tourne qu'en CI (`security-checks.yml`). Sonar : voir `CONTEXTE-TRANSVERSE.md`.

---

## Architecture

Clean Architecture + CQRS :

- `src/domain/` : logique métier pure (entités, interfaces de repository)
- `src/application/` : `commands/`, `queries/` (+ `query-models/` = DTOs réponse), `jobs/`, `authorizers/`, `tasks/`
- `src/infrastructure/` : `routes/` (controllers, `validation/` = DTOs requête), `repositories/`, `clients/`,
  `sequelize/` (`models/`, `migrations/`), `auth/`
- `src/building-blocks/` : `types/` (`command-handler`, `query-handler`, `job-handler`, `job-par-lots-handler`,
  `result`), `context.ts`
- Tests : `test/`, structure miroir de `src/`

### Patterns

- **Result** (`building-blocks/types/result.ts`) : pas d'exception métier, `success(data)` / `failure(new XxxError())`.
- **Authorizers** : toute mutation vérifie l'autorisation via un authorizer injecté avant d'agir.
- **Context** (AsyncLocalStorage, `building-blocks/context.ts`) : `getContextValue(ContextKey.UTILISATEUR)`.
- **Événements métier** : `EvenementService.creer(code, utilisateur, ...)` (audit + analytics).
- Dates : `luxon` (pas Moment.js).

### Nommage

| Type             | Convention                | Exemple                      |
|------------------|---------------------------|------------------------------|
| Command Handler  | `{Action}CommandHandler`  | `CreateActionCommandHandler` |
| Query Handler    | `{Action}QueryHandler`    | `GetActionsQueryHandler`     |
| Repository       | `{Entité}SqlRepository`   | `JeuneSqlRepository`         |
| Model Sequelize  | `{Entité}SqlModel`        | `JeuneSqlModel`              |
| DTO réponse      | `{Entité}QueryModel`      | `ActionQueryModel`           |
| DTO requête      | `{Action}Payload`         | `CreateActionPayload`        |
| Fichiers DB      | `*.db.ts`                 | `jeune-sql.repository.db.ts` |
| Tests            | `.test.ts` / `.db.test.ts`| Mocha + Chai + Sinon (+ Nock)|

---

## Conventions de code

Prettier et ESLint font foi (`.prettierrc`, config ESLint). Points non évidents :

- **Guillemets** : `singleQuote` sauf si la string contient une apostrophe → doubles guillemets
  (`"Votre bénéficiaire s'est inscrit"`). Vaut aussi pour les `it()` / `describe()`.
- `no-console` → logger NestJS ; `no-process-env` → `ConfigService` ; variables inutilisées préfixées `_`.
- Commentaires : voir **Conventions partagées → Commentaires** dans `CONTEXTE-TRANSVERSE.md`.

---

## Auth

- `OidcAuthGuard` (JWT émis par pass-emploi-connect) ; utilisateur injecté via `@Utilisateur()`.
- `ApiKeyAuthGuard` pour services internes / partenaires ; `@Public()` / `@SkipOidcAuth()` pour les routes ouvertes.
- `Authentification.Type` : `JEUNE`, `CONSEILLER`, `SUPPORT` ; `SUPERVISEUR` est un `Role`.
- Structures : enum `Core.Structure` (`src/domain/core.ts`).

---

## Exécution

Modes exclusifs : `IS_WEB=true` (HTTP), `IS_WORKER=true` (jobs Bull), `TASK_NAME=xxx` (one-off).
Post-deploy : `yarn tasks:initialiser-les-crons`.

Dev local : `yarn start` (`.environment` tel quel), `yarn start:local` (DB Docker, connect staging),
`yarn start:staging` (DB staging via tunnel Scalingo) ; variantes `yarn watch[:db-local|:staging]`.

`.environment.db-local` / `.environment.staging` sont **committés et sans secret** : ils surchargent
`ENVIRONMENT`, `DATABASE_URL`, `OIDC_ISSUER_URL` en référençant des variables nommées du vault
(`${DATABASE_URL_STAGING}`…). Chargés avant `.environment` via `dotenv-cli` (premier fichier gagne,
expansion `${…}` après chargement de tous les fichiers). En local, `ENVIRONMENT=development` est
obligatoire : `staging` force le SSL Sequelize (`providers.ts`) que le postgres Docker refuse.

---

## Points d'attention

1. **Migrations DB** : toujours une migration pour un changement de schéma.
2. **Tests DB** : `.db.test.ts` pour tout test qui touche la base.
3. **`resolutions` (sécurité)** : toujours `">=<version>"`, jamais `"^<version>"` ni version exacte. Le `^`
   plafonne le major (`^7.5.6` = `>=7.5.6 <8.0.0`) et recrée la CVE le jour où le correctif passe au major
   suivant ; `>=` laisse l'arbre se résoudre vers n'importe quelle version sûre plus récente.

# Pass Emploi API - Contexte Technique

> Backend API du projet Pass Emploi

---

@../pass-emploi-tools/docs/CONTEXTE-TRANSVERSE.md

---

# Contexte Technique API

> Cette section contient les informations techniques spécifiques au repo pass-emploi-api.

## Stack Technique

### Framework & Runtime

| Technologie         | Version    | Notes                    |
|---------------------|------------|--------------------------|
| **NestJS**          | 11.1.9     | Framework principal      |
| **TypeScript**      | 4.9.5      | Config stricte           |
| **Node.js**         | 22.14.0    | Défini dans `.nvmrc`     |
| **Package Manager** | Yarn 4.9.2 | Toujours utiliser `yarn` |

### Base de données & Cache

| Technologie    | Version | Usage                          |
|----------------|---------|--------------------------------|
| **PostgreSQL** | 14      | Base principale (avec PostGIS) |
| **Sequelize**  | 6.37.7  | ORM (+ sequelize-typescript)   |
| **Redis**      | 8       | Cache + Job Queue              |
| **Bull**       | 4.16.5  | Gestion des jobs asynchrones   |

### Bibliothèques principales

**Authentification :**

- `openid-client@5.7.1` : Client OIDC
- `jose@5.10.0` : Manipulation JWT

**HTTP & API :**

- `axios@1.13.2` : Client HTTP
- `@nestjs/swagger` : Documentation API
- `class-validator@0.14.3` : Validation DTO
- `class-transformer@0.5.1` : Transformation objets

**Monitoring :**

- `elastic-apm-node@3.52.2` : APM
- `pino` : Logging structuré

**Notifications :**

- `firebase-admin@13.6.0` : Push notifications

**Utilitaires :**

- `luxon@3.7.2` : Manipulation dates (pas Moment.js)
- `helmet@8.1.0` : Sécurité headers
- `compression@1.8.1` : Compression HTTP

### Testing

| Outil         | Version | Usage             |
|---------------|---------|-------------------|
| **Mocha**     | 11.7.5  | Test runner       |
| **Chai**      | 4.5.0   | Assertions        |
| **Sinon**     | 21.0.0  | Mocking           |
| **NYC**       | 17.1.0  | Coverage          |
| **Supertest** | 7.1.4   | Tests HTTP        |
| **Nock**      | 14.0.10 | Mock HTTP externe |

---

## Architecture

### Pattern : Clean Architecture + CQRS

```
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Controllers │  │ Repositories│  │ External Clients    │  │
│  │ (Routes)    │  │ (Sequelize) │  │ (APIs, Firebase)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application                              │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ Command Handlers    │  │ Query Handlers      │           │
│  │ (Mutations)         │  │ (Lectures)          │           │
│  └──────────┬──────────┘  └──────────┬──────────┘           │
│             │                        │                      │
│             ▼                        ▼                      │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ Authorizers         │  │ Query Models (DTOs) │           │
│  └─────────────────────┘  └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       Domain                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Entities    │  │ Value Objects│  │ Domain Services    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Structure des dossiers

```
src/
├── application/              # Couche applicative
│   ├── commands/             # Handlers de mutations
│   │   ├── action/
│   │   ├── milo/
│   │   ├── pole-emploi/
│   │   └── ...
│   ├── queries/              # Handlers de lectures
│   │   ├── query-getters/
│   │   ├── query-mappers/
│   │   └── query-models/     # DTOs réponse
│   ├── jobs/                 # Handlers de jobs asynchrones
│   ├── authorizers/          # Logique d'autorisation
│   └── tasks/                # Tâches one-off
│
├── building-blocks/          # Primitives réutilisables
│   └── types/
│       ├── command.ts
│       ├── command-handler.ts
│       ├── query-handler.ts
│       ├── result.ts         # Success/Failure monad
│       ├── domain-error.ts
│       └── brand.ts          # Type branding
│
├── domain/                   # Logique métier pure
│   ├── action/
│   ├── jeune/
│   ├── milo/
│   ├── offre/
│   ├── notification/
│   ├── rendez-vous/
│   └── ...
│
├── infrastructure/           # Implémentations techniques
│   ├── auth/                 # Guards et stratégies auth
│   ├── clients/              # Clients HTTP externes
│   ├── repositories/         # Accès données (Sequelize)
│   ├── sequelize/
│   │   ├── models/           # Modèles SQL
│   │   ├── migrations/       # Migrations DB
│   │   └── seeders/
│   ├── routes/               # Controllers NestJS
│   │   └── validation/       # DTOs requête
│   ├── middlewares/
│   └── decorators/
│
├── utils/                    # Services utilitaires
├── config/                   # Configuration centralisée
├── fixtures/                 # Fixtures de test
├── app.module.ts             # Module racine
└── main.ts                   # Point d'entrée
```

---

## Patterns clés

### 1. Command/Query Separation (CQS)

**Commands** (mutations) :

```typescript
// src/application/commands/action/create-action.command.handler.ts
export class CreateActionCommandHandler extends CommandHandler<
  CreateActionCommand,
  Action
> {
  async handle(command: CreateActionCommand): Promise<Result<Action>> {
    // ... validation et création
    return success(action)
  }
}
```

**Queries** (lectures) :

```typescript
// src/application/queries/action.query.handler.ts
export class GetActionQueryHandler {
  async handle(query: GetActionQuery): Promise<ActionQueryModel> {
    // ... récupération et mapping
  }
}
```

### 2. Result Monad

Gestion fonctionnelle des erreurs (pas d'exceptions métier) :

```typescript
import { Result, success, failure, isSuccess, isFailure } from './result'

// Retourner un succès
return success(data)

// Retourner une erreur métier
return failure(new NonTrouveError('Jeune', id))

// Vérifier le résultat
if (isSuccess(result)) {
  return result.data
}
if (isFailure(result)) {
  // Gérer l'erreur
}
```

### 3. Authorizers

Logique d'autorisation centralisée, injectée dans les handlers :

```typescript
// Vérification dans un CommandHandler
const authorized = await this.jeuneAuthorizer.autoriserPourConseillerDuJeune(
  jeuneId,
  utilisateur
)
if (!authorized) {
  return failure(new NonAutoriseError())
}
```

### 4. Context (AsyncLocalStorage)

Données de requête accessibles partout :

```typescript
import { Context, ContextKey } from './context'

// Récupérer l'utilisateur courant
const utilisateur = Context.get(ContextKey.UTILISATEUR)
```

### 5. Repository Pattern

Abstraction de la persistance :

```typescript
// Interface (domain)
interface JeuneRepository {
  get(id: string): Promise<Jeune | undefined>

  save(jeune: Jeune): Promise<void>
}

// Implémentation (infrastructure)
@Injectable()
export class JeuneSqlRepository implements JeuneRepository {
  // ... implémentation Sequelize
}
```

---

## Conventions de code

### Prettier

```json
{
  "tabWidth": 2,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "arrowParens": "avoid"
}
```

### Guillemets dans les strings TypeScript

Prettier impose `singleQuote: true`, mais les apostrophes dans le texte cassent le parsing. Règle :

- String **sans apostrophe** → simples guillemets : `'Votre bénéficiaire est inscrit'`
- String **avec apostrophe** → doubles guillemets : `"Votre bénéficiaire s'est inscrit"`

S'applique partout : code source, fichiers de test, strings dans les `it()`, `describe()`, etc.

### ESLint (règles importantes)

- `no-console`: error → utiliser le logger NestJS
- `no-process-env`: error → utiliser ConfigService
- `@typescript-eslint/explicit-function-return-type`: error
- `@typescript-eslint/no-explicit-any`: error
- Variables inutilisées ignorées avec préfixe `_`

### Nommage

| Type             | Convention                | Exemple                      |
|------------------|---------------------------|------------------------------|
| Command Handler  | `{Action}CommandHandler`  | `CreateActionCommandHandler` |
| Query Handler    | `{Action}QueryHandler`    | `GetActionsQueryHandler`     |
| Repository SQL   | `{Entité}SqlRepository`   | `JeuneSqlRepository`         |
| Repository Redis | `{Entité}RedisRepository` | `SessionRedisRepository`     |
| Controller       | `{Entité}Controller`      | `ActionController`           |
| Model Sequelize  | `{Entité}SqlModel`        | `JeuneSqlModel`              |
| DTO réponse      | `{Entité}QueryModel`      | `ActionQueryModel`           |
| DTO requête      | `{Action}Payload`         | `CreateActionPayload`        |
| Fichiers DB      | `*.db.ts`                 | `jeune-sql.repository.db.ts` |

### Tests

- Extension : `.test.ts`
- Tests DB : `.db.test.ts`
- Colocalisés dans `/test` (structure miroir de `/src`)
- Framework : Mocha + Chai + Sinon

```typescript
describe('CreateActionCommandHandler', () => {
  let handler: CreateActionCommandHandler

  beforeEach(() => {
    // Setup
  })

  it('should create action when authorized', async () => {
    // Test
  })
})
```

### Commentaires

- **Pas de commentaires explicatifs** dans le code : privilégier des noms
  explicites (types, fonctions, variables) qui rendent l'intention évidente.
  Un commentaire qui paraphrase ce que fait le code est à supprimer.
- **Exception** : un fait réellement non-évident et indispensable à la
  compréhension (ex. subtilité de fuseau horaire, contrainte métier contre-intuitive).
- **`// TODO:`** autorisés et encouragés pour tracer une suite de refacto / une
  dette assumée (ex. décommissionnement d'un getter remplacé, migration d'autres
  handlers). Les rendre actionnables (quoi migrer, vers quoi).
- Les marqueurs de structure de test (`// Given` / `// When` / `// Then`) sont une
  convention du repo, pas des commentaires explicatifs : ils restent.

---

## Scripts disponibles

### Développement

| Commande            | Description                              |
|---------------------|------------------------------------------|
| `yarn watch`        | Dev server avec hot reload + logs pretty |
| `yarn watch:worker` | Worker mode avec logs                    |
| `yarn start:debug`  | Avec debugger NestJS                     |

### Build & Lint

| Commande        | Description              |
|-----------------|--------------------------|
| `yarn build`    | Build TypeScript (dist/) |
| `yarn lint`     | ESLint check             |
| `yarn lint:fix` | ESLint auto-fix          |

### Base de données

| Commande                | Description                        |
|-------------------------|------------------------------------|
| `yarn start:pg:db`      | Démarrer PostgreSQL (Docker)       |
| `yarn start:redis:db`   | Démarrer Redis (Docker)            |
| `yarn migration`        | Exécuter migrations Sequelize      |
| `yarn seed`             | Seed toutes les données            |
| `yarn seed:referentiel` | Seed référentiels (communes, ROME) |
| `yarn psql`             | Accès psql via Docker              |

### Tests

| Commande               | Description               |
|------------------------|---------------------------|
| `yarn test`            | Full coverage (unit + db) |
| `yarn test:local:unit` | Tests unitaires           |
| `yarn test:local:db`   | Tests avec DB             |
| `yarn cover:report`    | Rapport coverage          |

### Tasks (one-off)

| Commande                           | Description              |
|------------------------------------|--------------------------|
| `yarn tasks:initialiser-les-crons` | Init crons (post-deploy) |
| `yarn tasks:nettoyer-les-donnees`  | Data cleanup             |
| `yarn tasks:dump-analytics`        | Dump pour analytics      |

### Release

| Commande             | Description           |
|----------------------|-----------------------|
| `yarn release:patch` | Version patch (x.x.X) |
| `yarn release:minor` | Version minor (x.X.0) |
| `yarn release:major` | Version major (X.0.0) |

---

## Authentification

### Stratégies

1. **OIDC (principal)** : Validation JWT via pass-emploi-connect
    - Guard : `OidcAuthGuard`
    - Décorateur : `@Utilisateur()` pour injecter l'utilisateur

2. **API Key** : Pour services internes/webhooks
    - Guard : `ApiKeyAuthGuard`
    - Header : `Authorization: Bearer <key>`

3. **Routes publiques** :
    - Décorateur : `@Public()`
    - Usage : health check, auth endpoints

### Utilisateur courant

```typescript
// Dans un controller
@Get()
async
getAction(
  @Utilisateur()
utilisateur: Authentification.Utilisateur
)
{
  // utilisateur.id, utilisateur.type, utilisateur.structure
}
```

Types d'utilisateurs : `JEUNE`, `CONSEILLER`, `SUPERVISEUR`
Structures : `PASS_EMPLOI`, `MILO`, `POLE_EMPLOI`, `CONSEIL_DEPT`

---

## Modes d'exécution

L'application peut démarrer en 3 modes (mutuellement exclusifs) :

| Mode       | Variable         | Usage                      |
|------------|------------------|----------------------------|
| **Web**    | `IS_WEB=true`    | Serveur HTTP (Controllers) |
| **Worker** | `IS_WORKER=true` | Processing jobs (Bull)     |
| **Task**   | `TASK_NAME=xxx`  | Script one-off             |

**Important post-deploy :** Exécuter `yarn tasks:initialiser-les-crons` pour initialiser les jobs planifiés.

---

## CI/CD

### GitHub Actions

**Workflow principal (`github-actions.yml`) :**

- Trigger : push sur `develop`/`master`, PR
- Services : PostgreSQL (PostGIS 14) + Redis 8
- Jobs : Install → Lint → Test → SonarQube

**Autres workflows :**

- `codeql.yml` : Scan sécurité CodeQL
- `semgrep-*.yml` : Analyse statique SAST

### Déploiement (Scalingo)

| Environnement | Branche   | Déclenchement |
|---------------|-----------|---------------|
| Staging       | `develop` | Automatique   |
| Production    | `master`  | Automatique   |

---

## Événements métier

Le système trace les événements importants via `EvenementService` :

```typescript
await this.evenementService.creer(
  Evenement.Code.ACTION_CREEE,
  utilisateur,
  { actionId: action.id }
)
```

Utilisé pour :

- Audit trail
- Analytics (pipeline ELT)
- Notifications

---

## Points d'attention

1. **Migrations DB** : Toujours créer une migration pour les changements de schéma
2. **Authorizers** : Vérifier les autorisations avant toute mutation
3. **Result pattern** : Ne pas throw d'exceptions métier, utiliser `failure()`
4. **Tests DB** : Utiliser `.db.test.ts` pour les tests nécessitant la DB
5. **Crons** : Penser à réinitialiser après un deploy (`yarn tasks:initialiser-les-crons`)
6. **`resolutions` (sécurité)** : Toujours noter une entrée de `resolutions` en `">=<version>"`, jamais en `"^<version>"` ni version exacte. Le `^` plafonne le major (`^7.5.6` = `>=7.5.6 <8.0.0`) et recrée la CVE le jour où le correctif passe au major suivant ; `>=` laisse l'arbre se résoudre vers n'importe quelle version sûre plus récente.
# Pass Emploi API - Contexte Technique

> Backend API du projet Pass Emploi

---

# Contexte Global Pass Emploi

> **Note aux développeurs** : Cette section contient le contexte global du projet Pass Emploi,
> partagé entre tous les repos (api, web, connect, app). Elle est placée ici car pass-emploi-api
> est le repo central du projet. Les autres repos (web, connect) référencent ce fichier.

## Vue d'ensemble

**Pass Emploi** (anciennement CEJ - Contrat d'Engagement Jeune) est une plateforme numérique développée pour accompagner
les bénéficiaires dans leur parcours d'insertion professionnelle.

**Note :** Le projet s'appelle maintenant "pass-emploi" mais l'ancienne dénomination "CEJ" reste présente dans certaines
parties du code legacy.

## Architecture Globale

### Schéma des interactions

```
                                    ┌─────────────────────┐
                                    │   IDPs Externes     │
                                    │  ┌───────────────┐  │
                                    │  │ France Travail│  │
                                    │  │    (OIDC)     │  │
                                    │  ├───────────────┤  │
                                    │  │     MILO      │  │
                                    │  │    (OIDC)     │  │
                                    │  ├───────────────┤  │
                                    │  │   Conseil     │  │
                                    │  │Départemental  │  │
                                    │  └───────────────┘  │
                                    └──────────┬──────────┘
                                               │
                                               ▼
┌──────────────────┐              ┌─────────────────────────┐
│                  │   Auth       │                         │
│  pass_emploi_app │◄────────────►│   pass-emploi-connect   │
│  (App Mobile)    │   OIDC       │   (Auth Broker OIDC)    │
│  Flutter         │              │   NestJS + Redis        │
│                  │              │                         │
└────────┬─────────┘              └─────────────┬───────────┘
         │                                      │
         │                                      │ Auth
         │ API                                  ▼
         │                        ┌─────────────────────────┐
         │                        │                         │
         └───────────────────────►│    pass-emploi-api      │
                                  │    (Backend API)        │
┌──────────────────┐   API        │    NestJS + PostgreSQL  │
│                  │◄────────────►│    + Redis              │
│  pass-emploi-web │              │                         │
│  (Web Conseiller)│              └─────────────┬───────────┘
│  Next.js         │                            │
│                  │◄───────────────────────────┘
└──────────────────┘      Firebase (Chat temps réel)
         │
         │ Auth OIDC
         ▼
┌───────────────────┐
│pass-emploi-connect│
└───────────────────┘
```

### Les 4 repositories

| Repository              | Rôle                            | Stack                        | Public cible           |
|-------------------------|---------------------------------|------------------------------|------------------------|
| **pass-emploi-api**     | Backend API REST                | NestJS, PostgreSQL, Redis    | -                      |
| **pass-emploi-web**     | Application web conseiller      | Next.js 15, React 19         | Conseillers            |
| **pass-emploi-connect** | Service d'authentification OIDC | NestJS, oidc-provider, Redis | -                      |
| **pass_emploi_app**     | Application mobile              | Flutter                      | Bénéficiaires (jeunes) |

## Dispositifs d'accompagnement

### CEJ (Contrat d'Engagement Jeune)

| Critère        | Valeur                                                 |
|----------------|--------------------------------------------------------|
| **Public**     | Jeunes 16-25 ans (29 ans si RQTH)                      |
| **Durée**      | 6-18 mois                                              |
| **Intensité**  | 15-20h/semaine minimum                                 |
| **Allocation** | Jusqu'à 561,68€/mois                                   |
| **Structures** | France Travail + Missions Locales                      |
| **Objectif**   | Emploi durable, apprentissage ou formation qualifiante |

### PACEA (Parcours Contractualisé d'Accompagnement)

| Critère        | Valeur                         |
|----------------|--------------------------------|
| **Public**     | Jeunes 16-25 ans               |
| **Durée**      | Maximum 24 mois                |
| **Intensité**  | Modulable                      |
| **Allocation** | Ponctuelle (jusqu'à 6x RSA/an) |
| **Structures** | Missions Locales               |
| **Objectif**   | Autonomie et emploi            |

## Acteurs et structures

### Types d'utilisateurs

- **Bénéficiaire / Jeune** : Utilisateur accompagné (app mobile)
- **Conseiller** : Accompagne les bénéficiaires (app web)
- **Superviseur** : Supervise plusieurs conseillers

### Structures (organisations)

| Structure                 | Code           | Description           |
|---------------------------|----------------|-----------------------|
| **France Travail**        | `POLE_EMPLOI`  | Ex-Pôle Emploi        |
| **Mission Locale**        | `MILO`         | Accompagnement jeunes |
| **Conseil Départemental** | `CONSEIL_DEPT` | RSA, BRSA             |
| **Pass Emploi**           | `PASS_EMPLOI`  | Structure générique   |

**Note :** Un conseiller peut appartenir à plusieurs structures et travailler sur plusieurs dispositifs simultanément.

## Glossaire

| Terme                    | Définition                                                 |
|--------------------------|------------------------------------------------------------|
| **Pass Emploi**          | Nom actuel du projet                                       |
| **CEJ**                  | Contrat d'Engagement Jeune (ancienne dénomination)         |
| **Bénéficiaire / Jeune** | Utilisateur accompagné par un conseiller                   |
| **Conseiller**           | Professionnel qui accompagne les bénéficiaires             |
| **Portefeuille**         | Ensemble des bénéficiaires suivis par un conseiller        |
| **Action**               | Tâche assignée à un bénéficiaire (atelier, démarche, etc.) |
| **Rendez-vous**          | RDV planifié entre conseiller et bénéficiaire              |
| **Démarche**             | Action spécifique France Travail                           |
| **Session MILO**         | Activité collective en Mission Locale                      |
| **MILO**                 | Mission Locale                                             |
| **France Travail**       | Nouveau nom de Pôle Emploi                                 |
| **RQTH**                 | Reconnaissance Qualité Travailleur Handicapé               |
| **SNP**                  | Situation Non Professionnelle                              |
| **BRSA**                 | Bénéficiaire RSA                                           |
| **PACEA**                | Parcours Contractualisé d'Accompagnement                   |

## Conventions partagées

### Stack commune

| Technologie         | Version    | Notes                             |
|---------------------|------------|-----------------------------------|
| **Node.js**         | 22.14.0    | Fichier `.nvmrc` dans chaque repo |
| **Package Manager** | Yarn 4.x   | Jamais npm                        |
| **TypeScript**      | 4.9+ / 5.x | Mode strict                       |

### Linting & Formatting

Tous les repos partagent des conventions similaires :

**Prettier :**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false
}
```

**ESLint :**

- Pas de `console.log` → utiliser le logger
- Pas de `process.env` direct → utiliser la config centralisée
- Pas de `any` sans justification

### Secrets & Variables d'environnement

**Outil : dotvault**

```bash
# Déchiffrer
npx dotvault decrypt

# Chiffrer après modification
npx dotvault encrypt
```

- Clé vault : demander à l'équipe ou Vaultwarden/Dashlane
- Fichier chiffré : `.vault` ou `.environment` (commité)
- Template : `.env.local.template` ou `.environment.template`

### Déploiement

**Plateforme : Scalingo**

- **Staging** : déploiement automatique sur push `develop`
- **Production** : déploiement automatique sur push `master`
- **Review Apps** : création automatique sur PR

### Release

Process similaire dans tous les repos :

```bash
yarn release:patch  # ou :minor / :major
git push --tags && git push origin develop
git checkout master && git merge develop && git push
```

## Fonctionnalités principales

| Fonctionnalité       | Description                               | Repos concernés          |
|----------------------|-------------------------------------------|--------------------------|
| **Messagerie**       | Chat temps réel conseiller ↔ bénéficiaire | api, web, app (Firebase) |
| **Offres d'emploi**  | Proposition et recherche d'offres         | api, web, app            |
| **Actions**          | Gestion des tâches/démarches              | api, web, app            |
| **Rendez-vous**      | Planification et suivi RDV                | api, web, app            |
| **Sessions MILO**    | Activités collectives                     | api, web                 |
| **Suivi des heures** | Comptabilisation activités                | api, web                 |

## Intégrations externes

| Service                | Usage                          | Repo principal    |
|------------------------|--------------------------------|-------------------|
| **France Travail API** | Offres d'emploi, profils       | api               |
| **MILO API**           | Sessions, événements, dossiers | api               |
| **Firebase**           | Messagerie temps réel          | api, web, app     |
| **Diagoriente**        | Métiers favoris                | api               |
| **Immersion Facile**   | Immersions professionnelles    | api               |
| **Service Civique**    | Engagements civiques           | api               |
| **Elastic APM**        | Monitoring                     | api, web, connect |
| **Matomo**             | Analytics web                  | web               |

## Liens utiles

### Repositories

- [pass-emploi-api](https://github.com/France-Travail/pass-emploi-api)
- [pass-emploi-web](https://github.com/France-Travail/pass-emploi-web)
- [pass-emploi-connect](https://github.com/France-Travail/pass-emploi-connect)
- [pass_emploi_app](https://github.com/France-Travail/pass_emploi_app)

### Documentation officielle des dispositifs

- [CEJ - Ministère du Travail](https://travail-emploi.gouv.fr/le-contrat-dengagement-jeune-cej)
- [CEJ - France Travail](https://www.francetravail.fr/actualites/a-laffiche/2022/le-contrat-dengagement-jeune-cej.html)
- [PACEA - Ministère du Travail](https://travail-emploi.gouv.fr/le-parcours-contractualise-daccompagnement-vers-lemploi-et-lautonomie-pacea)
- [1 jeune 1 solution](https://www.1jeune1solution.gouv.fr/)

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
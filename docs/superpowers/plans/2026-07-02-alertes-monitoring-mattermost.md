# Alertes Monitoring Mattermost — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Mettre en place des alertes Mattermost pertinentes et actionnables pour toutes les briques (api web, api worker, connect, front web, PostgreSQL, Redis) et supprimer le bruit des alertes Scalingo actuelles.

**Architecture :** On s'appuie sur la chaîne déjà en place — heartbeat Elastic (ping HTTP toutes les 5s), APM Elastic (les deux APIs sont instrumentées), et le bot Mattermost « CEJ Lama » (suivi des jobs). Les tâches code enrichissent les `/health` pour qu'ils reflètent l'état réel des dépendances (DB, Redis) et exposent un dead man's switch du worker ; les tâches config créent les règles d'alerte Kibana → webhook Mattermost et nettoient les alertes Scalingo.

**Tech Stack :** NestJS 11 + Terminus (`@nestjs/terminus` 11.1.1), Sequelize, Bull/ioredis, Elastic (Heartbeat, APM, Kibana alerting), Scalingo (notifiers/alerts), webhooks Mattermost (compatibles format Slack).

## Global Constraints

- Toujours `yarn` (jamais npm), Node 22.14.0.
- Prettier : `singleQuote: true`, pas de `;`, `arrowParens: avoid`. String contenant une apostrophe → doubles guillemets.
- ESLint : `explicit-function-return-type` et `no-explicit-any` en erreur, pas de `console.*` (logger NestJS), pas de `process.env` (ConfigService).
- Pas de commentaires explicatifs dans le code (sauf `// Given/When/Then` dans les tests).
- Tests : Mocha + Chai + Sinon, extension `.test.ts` (`.db.test.ts` si DB requise), structure miroir dans `/test`.
- Repo `pass-emploi-connect` : vitest, mêmes conventions Prettier.
- Les commits sont validés par Brice avant push (ne jamais pousser sans accord).
- Principe des alertes : **une alerte = une action immédiate**. Tout seuil inclut une durée de soutien (jamais d'alerte sur un pic ponctuel).

---

## Vue d'ensemble des tâches

| # | Tâche | Type | Repo |
|---|---|---|---|
| 1 | `/health` API : checks DB + Redis | Code | pass-emploi-api |
| 2 | `/health/worker` : dead man's switch du worker | Code | pass-emploi-api |
| 3 | `/health` connect : check Redis | Code | pass-emploi-connect |
| 4 | Fiabiliser l'envoi Mattermost de CEJ Lama | Code | pass-emploi-api |
| 5 | Heartbeat : monitor du worker | Config | pass-emploi-tools |
| 6 | Kibana : connector Mattermost + règles uptime (api, connect, front, worker) | Config | Kibana |
| 7 | Kibana : règles APM (5xx, latence, partenaires externes) | Config | Kibana |
| 8 | Scalingo : notifiers crash + suppression des alertes bruit | Config | Scalingo |
| 9 | Scalingo : alertes PostgreSQL et Redis (disque, connexions, mémoire) | Config | Scalingo |

Les tâches 1–4 sont indépendantes entre elles. Les tâches 5–7 dépendent de 1–3 (les règles d'alerte n'ont de sens que si `/health` dit la vérité). Les tâches 8–9 sont indépendantes.

---

### Task 1 : `/health` API — vérifier PostgreSQL et Redis

Aujourd'hui `health.check([])` renvoie 200 même si la DB est morte. Après cette tâche, `/health` renvoie 503 si PostgreSQL ou Redis (queue Bull) est injoignable — le heartbeat existant détectera donc les pannes de dépendances.

**Files :**
- Modify : `src/infrastructure/routes/health.controller.ts`
- Modify : `src/domain/planificateur.ts` (interface `Planificateur.Repository`)
- Modify : `src/infrastructure/repositories/planificateur-redis.repository.db.ts`
- Test : `test/infrastructure/routes/health.controller.test.ts` (à créer)

**Interfaces :**
- Produces : `Planificateur.Repository.verifierDisponibiliteQueue(): Promise<boolean>` ; `GET /health` → 200 `{ status: 'ok', info: { database, redis } }` ou 503.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `test/infrastructure/routes/health.controller.test.ts` :

```typescript
import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../src/domain/planificateur'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'
import { StubbedClass } from '../../utils'

describe('HealthController', () => {
  let app: INestApplication
  let planificateurRepository: StubbedClass<Planificateur.Repository>

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    planificateurRepository = app.get(PlanificateurRepositoryToken)
  })

  describe('GET /health', () => {
    it('retourne 200 quand la DB et Redis sont disponibles', async () => {
      // Given
      planificateurRepository.verifierDisponibiliteQueue.resolves(true)

      // When - Then
      await request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.OK)
    })

    it("retourne 503 quand Redis n'est pas disponible", async () => {
      // Given
      planificateurRepository.verifierDisponibiliteQueue.resolves(false)

      // When - Then
      await request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.SERVICE_UNAVAILABLE)
    })
  })
})
```

Note d'implémentation : vérifier dans `test/utils/module-for-testing.ts` comment les tokens (`PlanificateurRepositoryToken`, `SequelizeInjectionToken`) sont stubbés et adapter le `app.get(...)`. Si le Sequelize stubbé ne permet pas de simuler `query()`, ne tester via stub que la branche Redis et couvrir la branche DB dans un `.db.test.ts`.

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

Run : `yarn test:local:unit --grep "HealthController"`
Attendu : FAIL (`verifierDisponibiliteQueue` n'existe pas).

- [ ] **Step 3 : Ajouter `verifierDisponibiliteQueue` à l'interface et au repository**

Dans `src/domain/planificateur.ts`, interface `Repository` :

```typescript
    verifierDisponibiliteQueue(): Promise<boolean>
```

Dans `src/infrastructure/repositories/planificateur-redis.repository.db.ts` :

```typescript
  async verifierDisponibiliteQueue(): Promise<boolean> {
    try {
      await this.queue.isReady()
      return true
    } catch (_e) {
      return false
    }
  }
```

- [ ] **Step 4 : Implémenter les checks dans le controller**

Remplacer le contenu de `src/infrastructure/routes/health.controller.ts` :

```typescript
import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult
} from '@nestjs/terminus'
import { HealthCheckResult } from '@nestjs/terminus/dist/health-check/health-check-result.interface'
import { Sequelize } from 'sequelize-typescript'
import { ConfigService } from '@nestjs/config'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../domain/planificateur'
import { Public } from '../decorators/public.decorator'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Public()
@Controller()
@ApiTags('Metrics')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private configService: ConfigService,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {}

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.verifierBaseDeDonnees(),
      (): Promise<HealthIndicatorResult> => this.verifierRedis()
    ])
  }

  @Get('version')
  @HealthCheck()
  async version(): Promise<{ version: string }> {
    return { version: this.configService.get('version')! }
  }

  private async verifierBaseDeDonnees(): Promise<HealthIndicatorResult> {
    try {
      await this.sequelize.query('SELECT 1')
      return { database: { status: 'up' } }
    } catch (_e) {
      throw new HealthCheckError('database', { database: { status: 'down' } })
    }
  }

  private async verifierRedis(): Promise<HealthIndicatorResult> {
    const disponible =
      await this.planificateurRepository.verifierDisponibiliteQueue()
    if (!disponible) {
      throw new HealthCheckError('redis', { redis: { status: 'down' } })
    }
    return { redis: { status: 'up' } }
  }
}
```

- [ ] **Step 5 : Lancer les tests, vérifier qu'ils passent**

Run : `yarn test:local:unit --grep "HealthController"`
Attendu : PASS.

- [ ] **Step 6 : Lint + build**

Run : `yarn lint && yarn build`
Attendu : 0 erreur.

- [ ] **Step 7 : Commit (après validation Brice)**

```bash
git add src/infrastructure/routes/health.controller.ts src/domain/planificateur.ts src/infrastructure/repositories/planificateur-redis.repository.db.ts test/infrastructure/routes/health.controller.test.ts
git commit -m "feat: /health vérifie la disponibilité de PostgreSQL et Redis"
```

---

### Task 2 : `/health/worker` — dead man's switch du worker

Le cron `SUIVRE_FILE_EVENEMENTS_MILO` tourne toutes les 15 min et chaque job écrit dans la table `suivi_job` : c'est le heartbeat naturel du worker. Si aucune ligne n'a été écrite depuis 45 min, le worker est mort (ou Redis, ou les crons ont été perdus après un deploy). L'endpoint est exposé par le **web** (le worker n'a pas de serveur HTTP) et lit la DB partagée.

**Files :**
- Create : `src/infrastructure/monitoring/worker-health.service.db.ts`
- Modify : `src/infrastructure/routes/health.controller.ts`
- Modify : `src/app.module.ts` (déclarer le provider `WorkerHealthService`)
- Test : `test/infrastructure/monitoring/worker-health.service.db.test.ts`

**Interfaces :**
- Consumes : `SuiviJobSqlModel` (table `suivi_job`, colonne `date_execution`).
- Produces : `WorkerHealthService.leWorkerTourne(): Promise<boolean>` ; `GET /health/worker` → 200 ou 503.

- [ ] **Step 1 : Écrire le test DB qui échoue**

Créer `test/infrastructure/monitoring/worker-health.service.db.test.ts` (s'inspirer du bootstrap DB des autres `.db.test.ts`, ex. `getDatabase()` dans `test/utils/database-for-testing.ts`) :

```typescript
import { expect } from 'chai'
import { DateTime } from 'luxon'
import { WorkerHealthService } from '../../../src/infrastructure/monitoring/worker-health.service.db'
import { SuiviJobSqlModel } from '../../../src/infrastructure/sequelize/models/suivi-job.sql-model'
import { Planificateur } from '../../../src/domain/planificateur'
import { getDatabase } from '../../utils/database-for-testing'

describe('WorkerHealthService', () => {
  let service: WorkerHealthService

  beforeEach(async () => {
    await getDatabase().cleanPG()
    service = new WorkerHealthService()
  })

  it("retourne true quand un job a tourné il y a moins de 45 minutes", async () => {
    // Given
    await SuiviJobSqlModel.create({
      jobType: Planificateur.JobType.SUIVRE_FILE_EVENEMENTS_MILO,
      dateExecution: DateTime.now().minus({ minutes: 10 }).toJSDate(),
      succes: true,
      resultat: {},
      nbErreurs: 0,
      tempsExecution: 100,
      jobRunId: null
    })

    // When
    const resultat = await service.leWorkerTourne()

    // Then
    expect(resultat).to.equal(true)
  })

  it("retourne false quand aucun job n'a tourné depuis 45 minutes", async () => {
    // Given
    await SuiviJobSqlModel.create({
      jobType: Planificateur.JobType.SUIVRE_FILE_EVENEMENTS_MILO,
      dateExecution: DateTime.now().minus({ hours: 2 }).toJSDate(),
      succes: true,
      resultat: {},
      nbErreurs: 0,
      tempsExecution: 100,
      jobRunId: null
    })

    // When
    const resultat = await service.leWorkerTourne()

    // Then
    expect(resultat).to.equal(false)
  })

  it("retourne false quand la table suivi_job est vide", async () => {
    // When
    const resultat = await service.leWorkerTourne()

    // Then
    expect(resultat).to.equal(false)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run : `yarn test:local:db --grep "WorkerHealthService"`
Attendu : FAIL (module inexistant).

- [ ] **Step 3 : Implémenter le service**

Créer `src/infrastructure/monitoring/worker-health.service.db.ts` :

```typescript
import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { SuiviJobSqlModel } from '../sequelize/models/suivi-job.sql-model'

const SEUIL_INACTIVITE_WORKER_MINUTES = 45

@Injectable()
export class WorkerHealthService {
  async leWorkerTourne(): Promise<boolean> {
    const dernierSuivi = await SuiviJobSqlModel.findOne({
      order: [['date_execution', 'DESC']]
    })
    if (!dernierSuivi) {
      return false
    }
    const seuil = DateTime.now().minus({
      minutes: SEUIL_INACTIVITE_WORKER_MINUTES
    })
    return DateTime.fromJSDate(dernierSuivi.dateExecution) > seuil
  }
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run : `yarn test:local:db --grep "WorkerHealthService"`
Attendu : PASS.

- [ ] **Step 5 : Exposer l'endpoint dans le HealthController**

Dans `src/infrastructure/routes/health.controller.ts`, injecter le service et ajouter :

```typescript
  @Get('health/worker')
  @HealthCheck()
  checkWorker(): Promise<HealthCheckResult> {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        const actif = await this.workerHealthService.leWorkerTourne()
        if (!actif) {
          throw new HealthCheckError('worker', {
            worker: { status: 'down' }
          })
        }
        return { worker: { status: 'up' } }
      }
    ])
  }
```

Ajouter au constructeur : `private readonly workerHealthService: WorkerHealthService`, et déclarer `WorkerHealthService` dans les providers de `src/app.module.ts`.

- [ ] **Step 6 : Lint + build + tests complets du controller**

Run : `yarn lint && yarn build && yarn test:local:unit --grep "HealthController"`
Attendu : 0 erreur, tests PASS.

- [ ] **Step 7 : Commit (après validation Brice)**

```bash
git add src/infrastructure/monitoring/worker-health.service.db.ts src/infrastructure/routes/health.controller.ts src/app.module.ts test/infrastructure/monitoring/worker-health.service.db.test.ts
git commit -m "feat: endpoint /health/worker (dead man's switch du worker)"
```

---

### Task 3 : `/health` connect — vérifier Redis

**Repo : `pass-emploi-connect`.** Toutes les sessions OIDC vivent dans Redis : si Redis est mort, plus personne ne se connecte, mais `/health` répond 200 aujourd'hui.

**Files :**
- Modify : `src/app.controller.ts`
- Test : compléter le test existant du controller (chercher `app.controller` dans `test/`, sinon créer `test/app.controller.test.ts`)

**Interfaces :**
- Consumes : `RedisInjectionToken` (`src/redis/redis.provider.ts`), client `ioredis`.
- Produces : `GET /health` → 200 si `redis.ping()` répond, sinon 503.

- [ ] **Step 1 : Écrire le test vitest qui échoue**

```typescript
import { HealthCheckService } from '@nestjs/terminus'
import Redis from 'ioredis'
import { describe, expect, it, vi } from 'vitest'
import { AppController } from '../src/app.controller'

describe('AppController', () => {
  describe('GET /health', () => {
    it('est up quand redis répond au ping', async () => {
      // Given
      const redisClient = { ping: vi.fn().mockResolvedValue('PONG') }
      const deleteAccountUsecase = {
        execute: vi.fn()
      } as unknown as DeleteAccountUsecase
      const health = creerHealthCheckService()
      const controller = new AppController(
        health,
        deleteAccountUsecase,
        redisClient as unknown as Redis
      )

      // When
      const resultat = await controller.check()

      // Then
      expect(resultat.status).toEqual('ok')
    })
  })
})
```

Note d'implémentation : reprendre le harnais de test NestJS existant du repo connect (`Test.createTestingModule` avec overrides) plutôt que d'instancier `HealthCheckService` à la main si un module de test existe déjà.

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run : `yarn vitest run app.controller`
Attendu : FAIL (le constructeur ne prend pas de client Redis).

- [ ] **Step 3 : Implémenter le check dans `src/app.controller.ts`**

```typescript
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult
} from '@nestjs/terminus'
import Redis from 'ioredis'
import { RedisInjectionToken } from './redis/redis.provider'

  constructor(
    private health: HealthCheckService,
    private readonly deleteAccountUsecase: DeleteAccountUsecase,
    @Inject(RedisInjectionToken) private readonly redisClient: Redis
  ) {}

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.redisClient.ping()
          return { redis: { status: 'up' } }
        } catch (_e) {
          throw new HealthCheckError('redis', { redis: { status: 'down' } })
        }
      }
    ])
  }
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

Run : `yarn vitest run app.controller` puis `yarn lint && yarn build`
Attendu : PASS, 0 erreur.

- [ ] **Step 5 : Commit (après validation Brice)**

```bash
git add src/app.controller.ts test/
git commit -m "feat: /health vérifie la disponibilité de Redis"
```

---

### Task 4 : Fiabiliser l'envoi Mattermost de CEJ Lama

`envoyerMessageMattermost` avale silencieusement ses erreurs (`catch (_e) {}` dans `src/infrastructure/clients/suivi-job.service.db.ts:67`) : si le webhook casse, on perd les alertes jobs sans le savoir. On logge l'échec en error → il devient visible dans les logs Elastic et peut déclencher une règle Kibana.

**Files :**
- Modify : `src/infrastructure/clients/suivi-job.service.db.ts`
- Test : `test/infrastructure/clients/suivi-job.service.db.test.ts` (compléter s'il existe, sinon créer)

- [ ] **Step 1 : Écrire le test qui échoue**

```typescript
it("logge une erreur quand l'envoi Mattermost échoue", async () => {
  // Given
  const logger = { error: sinon.stub() }
  // injecter le stub de logger selon le pattern du service (Logger NestJS)
  httpService.post.throws(new Error('webhook indisponible'))

  // When
  await suiviJobService.notifierResultatJob(unSuiviJob())

  // Then
  expect(logger.error).to.have.been.calledOnce()
})
```

Note d'implémentation : suivre le pattern de stub du logger utilisé ailleurs dans `test/infrastructure/clients/`.

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run : `yarn test:local:unit --grep "SuiviJobService"`
Attendu : FAIL.

- [ ] **Step 3 : Implémenter**

Dans `src/infrastructure/clients/suivi-job.service.db.ts` :

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { buildError } from '../../utils/logger.module'

  private logger = new Logger('SuiviJobService')

  private async envoyerMessageMattermost(message: string): Promise<void> {
    const webhookUrl = this.configService.get('mattermost.jobWebhookUrl')

    try {
      const payload = {
        username: BOT_USERNAME,
        text: message
      }
      await firstValueFrom(this.httpService.post(webhookUrl, payload))
    } catch (e) {
      this.logger.error(
        buildError("Échec de l'envoi du message Mattermost", e as Error)
      )
    }
  }
```

- [ ] **Step 4 : Lancer les tests + lint**

Run : `yarn test:local:unit --grep "SuiviJobService" && yarn lint`
Attendu : PASS.

- [ ] **Step 5 : Commit (après validation Brice)**

```bash
git add src/infrastructure/clients/suivi-job.service.db.ts test/infrastructure/clients/suivi-job.service.db.test.ts
git commit -m "fix: logger l'échec d'envoi des messages Mattermost du suivi de jobs"
```

---

### Task 5 : Heartbeat — monitorer le worker

**Repo : `pass-emploi-tools`.** Ajouter un monitor HTTP sur `/health/worker` (créé en Task 2). Fréquence 60s : le seuil est de 45 min d'inactivité, inutile de pinger toutes les 5s.

**Files :**
- Modify : `heartbeat/heartbeat.template.yml`

- [ ] **Step 1 : Ajouter le monitor**

À la fin de `heartbeat.monitors` dans `heartbeat/heartbeat.template.yml` :

```yaml
  - type: http
    id: $API_SERVICE_NAME-worker-status
    name: $API_SERVICE_NAME Worker Status
    service.name: $API_SERVICE_NAME-worker
    hosts: ["$API_WORKER_HEALTH_URL"]
    check.response.status: [200]
    schedule: '@every 60s'
```

- [ ] **Step 2 : Déclarer la variable d'environnement**

Sur l'app Scalingo du heartbeat (staging et prod) : `API_WORKER_HEALTH_URL=https://<url-api>/health/worker`. Vérifier au passage ce que contient `API_URL` (URL de base ou URL `/health` complète) et rester cohérent.

- [ ] **Step 3 : Déployer et vérifier**

Redéployer l'app heartbeat, puis dans Kibana → Observability → Uptime : le monitor `Worker Status` doit apparaître **up**. Éteindre temporairement le worker en staging (scale à 0) et vérifier qu'il passe **down** au bout de ~45 min (test optionnel mais recommandé une fois, en staging).

- [ ] **Step 4 : Commit (après validation Brice)**

```bash
git add heartbeat/heartbeat.template.yml
git commit -m "feat: monitor heartbeat du worker api via /health/worker"
```

---

### Task 6 : Kibana — connector Mattermost + règles uptime

Créer un canal Mattermost dédié `#alertes-prod` (séparé du canal des rapports CEJ Lama : une alerte = action, un rapport = information).

- [ ] **Step 1 : Créer le webhook entrant Mattermost**

Mattermost → Intégrations → Webhooks entrants → créer sur le canal `#alertes-prod`. Noter l'URL.

- [ ] **Step 2 : Créer le connector Kibana**

Kibana → Stack Management → Rules and Connectors → Connectors → **Webhook** :
- Name : `Mattermost alertes prod`
- Method : `POST`, URL : l'URL du webhook Mattermost
- Header : `Content-Type: application/json`

- [ ] **Step 3 : Créer les 4 règles « Monitor status » (Uptime)**

Kibana → Observability → Uptime → Alerts and rules → Monitor status rule. Une règle par monitor (ou une règle globale si tous les monitors doivent alerter) :

| Monitor | Condition | Message |
|---|---|---|
| API Status | down sur 3 checks dans les 2 dernières minutes | 🔴 API down — vérifier deploy/DB/Redis, restart Scalingo si besoin |
| Auth (connect) Status | down sur 3 checks dans les 2 dernières minutes | 🔴 Connect down — **login impossible pour tous** — restart/rollback immédiat |
| Front Status | down sur 3 checks dans les 2 dernières minutes | 🔴 Front web down — restart/rollback immédiat |
| Worker Status | down sur 2 checks dans les 5 dernières minutes | 🔴 Worker inactif depuis 45 min — restart worker + `yarn tasks:initialiser-les-crons` |

Action de chaque règle : connector `Mattermost alertes prod`, body :

```json
{
  "username": "CEJ Alertes",
  "icon_emoji": ":rotating_light:",
  "text": "🔴 **{{context.monitorName}}** est DOWN ({{context.checkedAt}})\n{{context.message}}\nAction : <coller ici l'action du tableau ci-dessus>"
}
```

Le monitor Wordpress (doc) reste **sans** règle d'alerte : sa panne n'appelle pas d'action immédiate de l'équipe.

- [ ] **Step 4 : Tester une règle**

Passer temporairement le seuil d'une règle à « down sur 1 check », couper le service en staging, vérifier la réception du message Mattermost, remettre le seuil.

---

### Task 7 : Kibana — règles APM

Les deux APIs envoient déjà leurs traces à APM. Kibana → Observability → APM → Alerts and rules.

- [ ] **Step 1 : Règle « Failed transaction rate » par service**

Une règle pour `pass-emploi-api` (web), une pour `pass-emploi-connect` (reprendre les `service.name` exacts visibles dans APM) :
- Condition : taux de transactions en échec > **5 %** sur les **5 dernières minutes**
- Action → connector Mattermost, body :

```json
{
  "username": "CEJ Alertes",
  "icon_emoji": ":warning:",
  "text": "⚠️ **{{context.serviceName}}** : {{context.triggerValue}} de requêtes en erreur sur 5 min ({{context.viewInAppUrl}})\nAction : ouvrir APM, identifier la transaction, rollback si corrélé à un deploy"
}
```

- [ ] **Step 2 : Règle « Latency threshold » par service**

- Condition : latence **p95 > 3000 ms** soutenue sur **10 minutes** (jamais sur une requête isolée)
- Action : même connector, message « Action : chercher requête SQL lente ou partenaire externe en timeout (onglet Dependencies d'APM) ».

- [ ] **Step 3 : Règles partenaires externes (dependencies APM)**

Dans APM → Dependencies, identifier les noms des dépendances sortantes (Milo, France Travail, Brevo, Firebase, object storage/antivirus). Pour chacune, créer une règle **Error count threshold** ou un « dependency » alert selon la version de Kibana :
- Condition : taux d'échec > **50 %** sur **15 minutes** (seuil volontairement haut : un échec isolé chez un partenaire n'est pas actionnable)
- Message : « ⚠️ Partenaire **X** en panne — Action : ouvrir un incident avec le partenaire + prévenir le support utilisateurs »
- **Ne pas créer** de règle pour Diagoriente, Immersion, Matomo : leur panne ne justifie pas une alerte.

- [ ] **Step 4 : Règle sur les logs — webhook CEJ Lama cassé**

Kibana → Rules → Log threshold :
- Condition : message contient `Échec de l'envoi du message Mattermost` (log ajouté en Task 4), count > 0 sur 1 h
- Message : « ⚠️ Le bot CEJ Lama n'arrive plus à poster sur Mattermost — vérifier le webhook `mattermost.jobWebhookUrl` »

---

### Task 8 : Scalingo — notifiers utiles, suppression du bruit

- [ ] **Step 1 : Inventorier l'existant**

Pour chaque app (`api`, `connect`, `front` — staging et prod) :

```bash
scalingo --app <app> notifiers
scalingo --app <app> alerts
```

Coller la sortie dans un document avant toute suppression.

- [ ] **Step 2 : Créer un notifier « crash » vers Mattermost par app**

Les webhooks Mattermost acceptent le format Slack, donc la plateforme `slack` fonctionne :

```bash
scalingo --app <app> notifiers-add \
  --platform slack \
  --name "Mattermost alertes" \
  --webhook-url "<URL_WEBHOOK_MATTERMOST>" \
  --selected-events app_crashed,app_crashed_repeated,app_stopped
```

Vérifier les noms d'événements disponibles avec `scalingo --app <app> notifiers-add --help` (la liste exacte varie ; garder uniquement les événements de crash, **pas** `deployment` ni `app_restarted` qui sont normaux lors des deploys).

- [ ] **Step 3 : Supprimer les alertes bruit**

Supprimer (via `scalingo --app <app> alerts-remove <ID>`) toute alerte qui :
- porte sur un pic CPU/RAM **sans durée de soutien** ;
- porte sur le temps de réponse (remplacé par la règle APM p95 de la Task 7) ;
- se déclenche lors des restarts de deploy.

- [ ] **Step 4 : Créer la seule alerte métrique qui reste utile**

Par app, RAM soutenue (fuite mémoire → l'action est un restart + investigation) :

```bash
scalingo --app <app> alerts-add \
  --container-type web \
  --metric memory \
  --limit 0.90 \
  --duration-before-trigger 15m
```

(Vérifier la syntaxe exacte avec `scalingo alerts-add --help` ; brancher cette alerte sur le notifier Mattermost créé au Step 2.)

- [ ] **Step 5 : Vérifier en staging**

Provoquer un crash volontaire en staging (scale/stop) et vérifier que le message arrive sur `#alertes-prod` (ou un canal staging dédié).

---

### Task 9 : Scalingo — alertes bases de données

Dans le dashboard Scalingo de chaque addon (PostgreSQL de l'api, Redis de l'api, Redis de connect), onglet Alertes/Métriques :

- [ ] **Step 1 : PostgreSQL (api)**
  - Disque > **85 %** → action : vérifier que le cron `NETTOYER_LES_DONNEES` tourne (rapport CEJ Lama), sinon upsize du plan.
  - Connexions > **80 %** de `max_connections` pendant 5 min → action : chercher une fuite de connexions (config pool dans `src/infrastructure/sequelize/providers.ts`), scaler si légitime.

- [ ] **Step 2 : Redis (api — queue Bull)**
  - Mémoire > **80 %** soutenu 15 min → action : vérifier `NETTOYER_LES_JOBS`, purger, upsize. Si Redis est plein, plus aucune notification/rappel RDV ne part.

- [ ] **Step 3 : Redis (connect — sessions OIDC)**
  - Mémoire > **80 %** soutenu 15 min → action : vérifier le TTL des sessions, upsize.

- [ ] **Step 4 : Router ces alertes vers Mattermost**

Si le dashboard Scalingo ne permet pas de router les alertes d'addon vers un webhook, les brancher sur le notifier créé en Task 8 Step 2, ou à défaut sur l'email d'équipe avec redirection.

---

## Récapitulatif de la couverture (spec → tâches)

| Alerte de la synthèse | Couverte par |
|---|---|
| API web down | Heartbeat existant + Task 1 (health réel) + Task 6 |
| Connect down | Heartbeat existant + Task 3 + Task 6 |
| **Front web down** | Heartbeat existant (`FRONT_URL`) + Task 6 |
| Health dégradé (DB/Redis KO) | Tasks 1, 3 (le 503 fait tomber le monitor uptime) |
| Worker mort (dead man's switch) | Tasks 2, 5, 6 |
| Cron critique non exécuté | Task 2 (couvert par le dead man's switch, `suivi_job` global) |
| Job en échec | Déjà en place (CEJ Lama) |
| Pic 5xx / latence | Task 7 |
| Partenaires externes (Milo, FT, Brevo, Firebase, storage) | Task 7 Step 3 |
| Webhook CEJ Lama cassé | Tasks 4, 7 Step 4 |
| Crash / crash-loop containers | Task 8 |
| Postdeploy/migrations en échec | Task 8 (événements de deploy en échec si disponibles chez Scalingo, sinon visible via crash) |
| Disque PostgreSQL, connexions, mémoire Redis | Task 9 |
| Rapport quotidien absent à 9h45 | Couvert indirectement par Tasks 2+4 (worker mort → alerte ; webhook cassé → alerte log) |
| Suppression du bruit Scalingo | Task 8 Step 3 |
| `DUMP_ANALYTICS` en échec | Déjà notifié par CEJ Lama |
| Saturation file événements Milo | **Non automatisée dans ce plan** — lisible dans le rapport quotidien (`nombreEvenementsTraites` = max). À automatiser plus tard si le cas se produit réellement (YAGNI). |
| Expiration secrets/certs IDP (connect) | **Hors plan** — nécessite un inventaire des secrets côté connect d'abord ; à traiter dans un plan dédié. |

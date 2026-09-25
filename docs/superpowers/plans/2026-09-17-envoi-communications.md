# Envoi des communications NOTIFICATION — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le job `NOTIFIER_BENEFICIAIRES` (un gros job par quart de population, sans reprise) et le cron v1 `NOTIFIER_COMMUNICATIONS` par un cron unique à la minute qui envoie les communications `NOTIFICATION` par lots fixes, piloté par l'état en base, avec suivi, annulation et garde-fous de mise en production ; puis supprimer la route `POST /support/notifier-beneficiaires`.

**Architecture:** La population d'une communication `NOTIFICATION` est figée dans une table `communication_envoi` (une ligne par jeune, statut). Un cron `ENVOYER_COMMUNICATIONS` (`* 8-16 * * 1-5`) fait à chaque tick **une** chose : envoyer un lot de 300 lignes `A_ENVOYER` de la communication `EN_COURS`, ou démarrer la prochaine communication `A_ENVOYER` due, ou rien. Le statut de la communication (`A_ENVOYER` → `EN_COURS` → `ENVOYEE` | `ANNULEE` | `EN_ERREUR`) remplace `envoyee_le` et pilote le cron et l'annulation. Toute lecture-puis-écriture sur `communication_envoi` est atomique (`UPDATE … RETURNING`, `FOR UPDATE SKIP LOCKED`) parce que plusieurs workers tournent en prod.

**Tech Stack:** NestJS 11, Sequelize 6 (+ sequelize-typescript, raw queries), Bull 4 / Redis, Luxon, Mocha + Chai + Sinon, tests DB avec `getDatabase()`.

**Spec:** `docs/superpowers/specs/2026-09-17-envoi-communications-design.md` (v2 du 2026-09-22 — la lire avant d'exécuter).

## Global Constraints

- Prettier : `semi: false`, `singleQuote: true`, `trailingComma: none`, `arrowParens: avoid`. String avec apostrophe → doubles guillemets.
- ESLint : pas de `console`, pas de `process.env` hors `configuration.ts`, types de retour explicites, pas de `any`.
- Pas de commentaires sauf fait non-évident, `// TODO:` actionnable, ou `// Given / When / Then`.
- Result monad : pas de `throw` métier, `failure(new MauvaiseCommandeError(...))`.
- Logs : `rootLogger` au format ECS (`event.action` au passé + `event.outcome`), niveaux `info` / `error` seulement, jamais d'exception brute (`toEcsError(e)`). Réf. `pass-emploi-tools/docs/observabilite/logs-ecs/conventions.md`.
- Tests : `.test.ts` unitaires, `.db.test.ts` avec DB. Structure miroir `test/` ↔ `src/`. Les tests DB tournent sur une base migrée (`yarn db:test` lance les migrations).
- Vérifications avant chaque commit : `yarn tsc --noEmit` (pas `yarn build`, qui ne typecheck pas les tests), `yarn lint`, et les tests du périmètre. Un seul fichier de test DB : `TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha <fichier> --exit --timeout 10000`.
- Commits découpés par tâche, messages en français, préfixe `feat(communications):` / `refactor(communications):` / `docs:`, terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Timezone du cron : `CRON_TIMEZONE` déjà utilisé par `ajouterCronJob` (Europe/Paris).
- **Plusieurs conteneurs `worker` en prod** : deux ticks peuvent tourner en parallèle. Jamais de `SELECT` puis `UPDATE` sur `communication_envoi` ou sur le statut d'une communication.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/domain/communication.ts` | `StatutEnvoi`, `estModifiable`, `AEnvoyer`, `Repository` étendu ; `push == null` |
| `src/domain/communication-envoi.ts` | `CommunicationEnvoi.Statut`, `Compteurs` |
| `src/infrastructure/sequelize/migrations/20260917000000-communications-notification.js` | **modifiée** : ne crée plus `envoyee_le` |
| `src/infrastructure/sequelize/migrations/20260922000000-communication-envoi.js` | colonnes d'envoi sur `communication`, table `communication_envoi`, reprise `ANNULEE` |
| `src/infrastructure/sequelize/models/communication.sql-model.ts` | `envoyeeLe` → `statutEnvoi`, `envoiTermineLe`, `echecsConsecutifs`, `nb*` |
| `src/infrastructure/sequelize/models/communication-envoi.sql-model.ts` + `models/index.ts` | nouveau modèle |
| `src/domain/notification/notification.ts`, `src/infrastructure/clients/firebase-client.ts`, `src/infrastructure/repositories/notification-firebase.repository.db.ts` | `send` retourne `ResultatEnvoi` |
| `src/infrastructure/repositories/communication.repository.db.ts` | réclamer + figer, libérer, réserver, marquer, rendre, compter, terminer, échecs de lot, `compterDestinataires` |
| `src/config/configuration.ts`, `test/utils/test-config.ts` | `jobs.envoiCommunications` |
| `src/domain/planificateur.ts`, `src/domain/suivi-job.ts`, `src/building-blocks/types/job-handler.ts` | `JobType.ENVOYER_COMMUNICATIONS`, cron, exclusions, tick silencieux |
| `src/application/jobs/envoyer-communications.job.handler.db.ts` | le cron |
| `src/application/commands/support/{creer,modifier,supprimer}-communication.command.handler.db.ts` | statut initial, garde-fous |
| `src/application/commands/support/annuler-envoi-communication.command.handler.db.ts` | annulation |
| `src/application/queries/get-population-support.query.handler.db.ts` + `query-models/population-support.query-model.ts` | `statutEnvoi`, `envoiTermineLe`, `envoi`, `nbDestinataires` |
| `src/infrastructure/routes/support-deploiements.controller.ts` | route annulation |
| `src/application/jobs/nettoyer-les-donnees.job.handler.db.ts` | purge 30 j |
| `src/application/jobs/notifier-communications.job.handler.db.ts`, `notifier-beneficiaires.job.handler.db.ts`, `src/application/commands/notifier-beneficiaires.command.handler.ts`, `src/infrastructure/routes/support.controller.ts`, `validation/support.inputs.ts` | supprimés / nettoyés |
| `src/app.module.ts` | providers |
| `docs/decisions/ADR-007-communications.md`, `docs/TROUBLESHOOT.md` | mise à jour |

---

### Task 1 : Domaine — statuts d'envoi

**Files:**
- Modify: `src/domain/communication.ts`
- Create: `src/domain/communication-envoi.ts`
- Test: `test/domain/communication.test.ts`

**Interfaces:**
- Produces:
  ```ts
  Communication.StatutEnvoi = { A_ENVOYER, EN_COURS, ENVOYEE, ANNULEE, EN_ERREUR }
  Communication.estModifiable(statut: StatutEnvoi | null): boolean            // null (IN_APP) ou A_ENVOYER
  Communication.AEnvoyer { id: number; idPopulation: string; titre: string; contenu: string; typeNotification?: Notification.Type; push: boolean; echecsConsecutifs: number }
  CommunicationEnvoi.Statut = { A_ENVOYER, EN_COURS, ENVOYEE, ERREUR, TOKEN_INVALIDE }
  CommunicationEnvoi.Compteurs { aEnvoyer: number; enCours: number; envoyees: number; erreurs: number; tokensInvalides: number }
  ```
- Le `Repository` domaine est étendu en Task 4 (pour ne pas casser la compilation du repo SQL ici).

- [ ] **Step 1 : Tests**

Dans `test/domain/communication.test.ts`, à la fin du `describe('Communication', …)` :

```ts
  describe('estModifiable', () => {
    it('est vrai sans statut (IN_APP) ou en A_ENVOYER', () => {
      expect(Communication.estModifiable(null)).to.equal(true)
      expect(
        Communication.estModifiable(Communication.StatutEnvoi.A_ENVOYER)
      ).to.equal(true)
    })

    it('est faux dès que l’envoi a démarré', () => {
      for (const statut of [
        Communication.StatutEnvoi.EN_COURS,
        Communication.StatutEnvoi.ENVOYEE,
        Communication.StatutEnvoi.ANNULEE,
        Communication.StatutEnvoi.EN_ERREUR
      ]) {
        expect(Communication.estModifiable(statut)).to.equal(false)
      }
    })
  })
```

Et dans le `describe` des règles `NOTIFICATION` existant, ajouter :

```ts
    it('refuse une communication NOTIFICATION avec push: null', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        push: null as unknown as undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
    })

    it('refuse une communication IN_APP avec push: null', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        push: null as unknown as undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
    })
```

(`@IsOptional()` laisse passer `null` côté payload ; le domaine doit le refuser comme une absence.)

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:unit -- --grep 'Communication'`
Expected: FAIL — `estModifiable` / `StatutEnvoi` inexistants ; le test `push: null` échoue (passe en succès).

- [ ] **Step 3 : Domaine**

Créer `src/domain/communication-envoi.ts` :

```ts
export namespace CommunicationEnvoi {
  export enum Statut {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ERREUR = 'ERREUR',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE'
  }

  export interface Compteurs {
    aEnvoyer: number
    enCours: number
    envoyees: number
    erreurs: number
    tokensInvalides: number
  }
}
```

Dans `src/domain/communication.ts`, dans le namespace, après `enum Type` :

```ts
  export enum StatutEnvoi {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ANNULEE = 'ANNULEE',
    EN_ERREUR = 'EN_ERREUR'
  }

  export interface AEnvoyer {
    id: number
    idPopulation: string
    titre: string
    contenu: string
    typeNotification?: Notification.Type
    push: boolean
    echecsConsecutifs: number
  }

  export function estModifiable(statut: StatutEnvoi | null): boolean {
    return statut === null || statut === StatutEnvoi.A_ENVOYER
  }
```

Dans `creer` : remplacer `aCreer.push === undefined` par `aCreer.push == null`, et `aCreer.push !== undefined` (branche `else`) par `aCreer.push != null`.

- [ ] **Step 4 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:unit -- --grep 'Communication'`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add src/domain/communication.ts src/domain/communication-envoi.ts test/domain/communication.test.ts
git commit -m "feat(communications): statuts d'envoi et refus de push null"
```

---

### Task 2 : Migration et modèles Sequelize

**Files:**
- Modify: `src/infrastructure/sequelize/migrations/20260917000000-communications-notification.js` (retirer `envoyee_le`, jamais déployée)
- Create: `src/infrastructure/sequelize/migrations/20260922000000-communication-envoi.js`
- Modify: `src/infrastructure/sequelize/models/communication.sql-model.ts`
- Create: `src/infrastructure/sequelize/models/communication-envoi.sql-model.ts`
- Modify: `src/infrastructure/sequelize/models/index.ts`
- Modify: `src/application/queries/get-population-support.query.handler.db.ts`, `query-models/population-support.query-model.ts` (retirer `envoyeeLe` — remplacé en Task 7)
- Modify: `test/application/commands/support/communications.command.handlers.db.test.ts` (test « ne touche pas à envoyeeLe » → `statutEnvoi`)
- Modify: `test/application/queries/get-population-support.query.handler.db.test.ts` (toute assertion sur `envoyeeLe`)

**Interfaces:**
- Produces:
  ```ts
  CommunicationSqlModel.statutEnvoi: Communication.StatutEnvoi | null
  CommunicationSqlModel.envoiTermineLe: Date | null
  CommunicationSqlModel.echecsConsecutifs: number
  CommunicationSqlModel.nbEnvoyees / nbErreurs / nbTokensInvalides: number | null
  CommunicationEnvoiSqlModel { idCommunication: number; idJeune: string; statut: CommunicationEnvoi.Statut; dateTraitement: Date | null }
  ```

- [ ] **Step 1 : Migration 20260917 — retirer `envoyee_le`**

Dans `20260917000000-communications-notification.js`, supprimer les deux blocs `envoyee_le` (`addColumn` dans `up`, `removeColumn` dans `down`). Il ne reste que `type_notification`.

- [ ] **Step 2 : Migration 20260922**

```js
'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      // Bases locales / review apps qui ont joué la v1 de 20260917 ; jamais en prod.
      await queryInterface.sequelize.query(
        'ALTER TABLE communication DROP COLUMN IF EXISTS envoyee_le',
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'statut_envoi',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'envoi_termine_le',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'echecs_consecutifs',
        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        { transaction }
      )
      for (const colonne of ['nb_envoyees', 'nb_erreurs', 'nb_tokens_invalides']) {
        await queryInterface.addColumn(
          'communication',
          colonne,
          { type: Sequelize.INTEGER, allowNull: true },
          { transaction }
        )
      }
      // Reprise : rien ne doit partir du seul fait du déploiement.
      await queryInterface.sequelize.query(
        `UPDATE communication SET statut_envoi = 'ANNULEE', envoi_termine_le = NOW() WHERE type = 'NOTIFICATION'`,
        { transaction }
      )

      await queryInterface.createTable(
        'communication_envoi',
        {
          id_communication: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'communication', key: 'id' },
            onDelete: 'CASCADE'
          },
          id_jeune: {
            type: Sequelize.STRING,
            allowNull: false,
            primaryKey: true,
            references: { model: 'jeune', key: 'id' },
            onDelete: 'CASCADE'
          },
          statut: { type: Sequelize.STRING, allowNull: false },
          date_traitement: { type: Sequelize.DATE, allowNull: true }
        },
        { transaction }
      )
      await queryInterface.addIndex(
        'communication_envoi',
        ['id_communication', 'statut'],
        { name: 'communication_envoi_id_communication_statut', transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable('communication_envoi', { transaction })
      for (const colonne of [
        'statut_envoi',
        'envoi_termine_le',
        'echecs_consecutifs',
        'nb_envoyees',
        'nb_erreurs',
        'nb_tokens_invalides'
      ]) {
        await queryInterface.removeColumn('communication', colonne, {
          transaction
        })
      }
    })
  }
}
```

- [ ] **Step 3 : Modèles**

Dans `communication.sql-model.ts`, remplacer le bloc `envoyeeLe` par :

```ts
  @Column({ field: 'statut_envoi', type: DataType.STRING })
  statutEnvoi: Communication.StatutEnvoi | null

  @Column({ field: 'envoi_termine_le', type: DataType.DATE })
  envoiTermineLe: Date | null

  @Column({ field: 'echecs_consecutifs', type: DataType.INTEGER })
  echecsConsecutifs: number

  @Column({ field: 'nb_envoyees', type: DataType.INTEGER })
  nbEnvoyees: number | null

  @Column({ field: 'nb_erreurs', type: DataType.INTEGER })
  nbErreurs: number | null

  @Column({ field: 'nb_tokens_invalides', type: DataType.INTEGER })
  nbTokensInvalides: number | null
```

Créer `communication-envoi.sql-model.ts` :

```ts
import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { CommunicationEnvoi } from '../../../domain/communication-envoi'
import { CommunicationSqlModel } from './communication.sql-model'
import { JeuneSqlModel } from './jeune.sql-model'

@Table({ timestamps: false, tableName: 'communication_envoi' })
export class CommunicationEnvoiSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => CommunicationSqlModel)
  @Column({ field: 'id_communication', type: DataType.INTEGER })
  idCommunication: number

  @PrimaryKey
  @ForeignKey(() => JeuneSqlModel)
  @Column({ field: 'id_jeune', type: DataType.STRING })
  idJeune: string

  @Column({ field: 'statut', type: DataType.STRING })
  statut: CommunicationEnvoi.Statut

  @Column({ field: 'date_traitement', type: DataType.DATE })
  dateTraitement: Date | null
}
```

L'ajouter à `models/index.ts` (import + entrée dans `sqlModels`, à côté de `CommunicationSqlModel`).

- [ ] **Step 4 : Retirer `envoyeeLe` des lecteurs**

- `get-population-support.query.handler.db.ts` : supprimer les 3 lignes `envoyeeLe: co.envoyeeLe ? … : undefined`.
- `population-support.query-model.ts` : supprimer la propriété `envoyeeLe` et son `@ApiPropertyOptional`.
- `communications.command.handlers.db.test.ts` : remplacer le test « ne touche pas à envoyeeLe » par :

```ts
    it("ne touche pas au statut d'envoi : le remplacement n'est pas un nouvel envoi", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        titre: 'Courte corrigée',
        contenu: 'Court',
        dateFin: undefined
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communicationModifiee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationModifiee!.statutEnvoi).to.equal(
        Communication.StatutEnvoi.A_ENVOYER
      )
    })
```

- `get-population-support.query.handler.db.test.ts` et tout autre test : `grep -rn envoyeeLe test src` doit ne plus rien renvoyer hors `notifier-communications.job.handler.db.ts` et son test (supprimés en Task 9 — les laisser compiler en remplaçant leurs `envoyeeLe` par `statutEnvoi: null` si nécessaire, ou les supprimer dès maintenant : **les supprimer dès maintenant** est plus simple, voir Step 5).

- [ ] **Step 5 : Supprimer le cron v1 tout de suite**

Il ne compile plus sans `envoyeeLe` et il est remplacé par la Task 5 :

```bash
git rm src/application/jobs/notifier-communications.job.handler.db.ts test/application/jobs/notifier-communications.job.handler.db.test.ts
```

Retirer `NotifierCommunicationsJobHandler` de `src/app.module.ts` (import + liste des jobs). Laisser `JobType.NOTIFIER_COMMUNICATIONS` et son cron dans `planificateur.ts` pour l'instant (Task 5 les remplace).

- [ ] **Step 6 : Vérifier**

Run: `yarn db:test && yarn tsc --noEmit && yarn lint && yarn test:local:db -- --grep 'Communication|Population'`
Expected: PASS (la migration passe sur la base de test).

- [ ] **Step 7 : Commit**

```bash
git add -A src test
git commit -m "feat(communications): statut d'envoi et table communication_envoi"
```

---

### Task 3 : `Notification.Repository.send` retourne le résultat d'envoi

**Files:**
- Modify: `src/domain/notification/notification.ts`
- Modify: `src/infrastructure/clients/firebase-client.ts:102-123`
- Modify: `src/infrastructure/repositories/notification-firebase.repository.db.ts:125-155`
- Test: `test/infrastructure/repositories/notification-firebase.repository.db.test.ts`, `test/infrastructure/clients/firebase-client.test.ts`

**Interfaces:**
- Produces:
  ```ts
  Notification.ResultatEnvoi = { ENVOYEE, TOKEN_INVALIDE, ERREUR }
  FirebaseClient.send(tokenMessage): Promise<Notification.ResultatEnvoi>
  Notification.Repository.send(message, idJeune?, pushNotification?): Promise<Notification.ResultatEnvoi>  // ENVOYEE sans appel Firebase si pushNotification = false
  ```
- Les appelants existants ignorent la valeur de retour. Seule différence : le repository **awaite** Firebase (il ne le faisait pas).

- [ ] **Step 1 : Tests du repository**

Dans `test/infrastructure/repositories/notification-firebase.repository.db.test.ts`, `describe('send')` :

```ts
    it('retourne le résultat de Firebase quand le push est activé', async () => {
      // Given
      firebaseClient.send.resolves(Notification.ResultatEnvoi.TOKEN_INVALIDE)

      // When
      const resultat = await repository.send(message, 'idJeune', true)

      // Then
      expect(resultat).to.equal(Notification.ResultatEnvoi.TOKEN_INVALIDE)
    })

    it('retourne ENVOYEE sans appeler Firebase quand le push est désactivé', async () => {
      // When
      const resultat = await repository.send(message, 'idJeune', false)

      // Then
      expect(resultat).to.equal(Notification.ResultatEnvoi.ENVOYEE)
      expect(firebaseClient.send).not.to.have.been.called()
    })
```

Dans `test/infrastructure/clients/firebase-client.test.ts`, s'il existe un `describe('send')`, ajouter un cas où `messaging.send` rejette avec `new FirebaseMessagingError({ code: 'messaging/registration-token-not-registered', message: '' })` → `TOKEN_INVALIDE`, un cas rejet quelconque → `ERREUR`, un cas succès → `ENVOYEE`. Sinon, se contenter des tests repository.

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'NotificationFirebaseSqlRepository'`
Expected: FAIL — `ResultatEnvoi` inexistant.

- [ ] **Step 3 : Domaine**

Dans `notification.ts`, avant `interface Repository` :

```ts
  export enum ResultatEnvoi {
    ENVOYEE = 'ENVOYEE',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE',
    ERREUR = 'ERREUR'
  }
```

et `send(...): Promise<ResultatEnvoi>` dans l'interface.

- [ ] **Step 4 : Firebase client**

```ts
  async send(tokenMessage: TokenMessage): Promise<Notification.ResultatEnvoi> {
    try {
      await this.messaging.send(tokenMessage)
      this.logger.log(tokenMessage)
      return Notification.ResultatEnvoi.ENVOYEE
    } catch (e) {
      const errorMessage = `Impossible d'envoyer de notification sur le token ${tokenMessage.token}`
      if (
        e instanceof FirebaseMessagingError &&
        [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token'
        ].includes(e.code)
      ) {
        this.logger.warn(buildError(errorMessage, e))
        return Notification.ResultatEnvoi.TOKEN_INVALIDE
      }
      this.logger.error(buildError(errorMessage, e))
      this.apmService.captureError(e)
      return Notification.ResultatEnvoi.ERREUR
    }
  }
```

- [ ] **Step 5 : Repository**

```ts
  async send(
    message: Notification.Message,
    idJeune?: string,
    pushNotification: boolean = true
  ): Promise<Notification.ResultatEnvoi> {
    const messageFirebase: NotificationRepository = {
      ...message,
      data: {
        ...message.data,
        type: typeNotificationToTypeNotificationRepository(message.data.type)
      }
    }
    let resultat = Notification.ResultatEnvoi.ENVOYEE
    if (pushNotification) {
      resultat = await this.firebaseClient.send(messageFirebase)
      this.matomoClient.trackEventPushNotificationEnvoyee(messageFirebase)
    }
    if (idJeune) {
      const notifSql: AsSql<NotificationJeuneDto> = {
        id: this.idService.uuid(),
        idJeune,
        dateNotif: this.dateService.now().toJSDate(),
        type: messageFirebase.data.type,
        titre: message.notification.title,
        description: message.notification.body,
        idObjet: message.data.id || null
      }
      NotificationJeuneSqlModel.create(notifSql).catch(e => {
        this.logger.error('Erreur création ', e)
      })
    }
    return resultat
  }
```

- [ ] **Step 6 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:db -- --grep 'Notification' && yarn test:local:unit -- --grep 'Firebase'`
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/domain/notification/notification.ts src/infrastructure/clients/firebase-client.ts src/infrastructure/repositories/notification-firebase.repository.db.ts test
git commit -m "feat(notification): send retourne le résultat d'envoi Firebase"
```

---

### Task 4 : Repository — réclamer, figer, réserver, marquer, compter

**Files:**
- Modify: `src/domain/communication.ts` (interface `Repository`)
- Modify: `src/infrastructure/repositories/communication.repository.db.ts`
- Test: `test/infrastructure/repositories/communication.repository.db.test.ts`

**Interfaces:**
- Produces (ajouts à `Communication.Repository`) :
  ```ts
  recupererEnvoiEnCours(): Promise<Communication.AEnvoyer | undefined>
  // Réclame atomiquement la première NOTIFICATION A_ENVOYER due (JEUNE, push non nul) et fige sa population. undefined si aucune ou si un autre tick l'a prise.
  demarrerProchainEnvoi(maintenant: DateTime): Promise<Communication.AEnvoyer | undefined>
  libererEnvoisBloques(idCommunication: number, avant: DateTime): Promise<number>
  reserverEnvois(idCommunication: number, nombre: number, maintenant: DateTime): Promise<Array<{ idJeune: string; token: string | null }>>
  marquerEnvoi(idCommunication: number, idJeune: string, statut: CommunicationEnvoi.Statut, maintenant: DateTime): Promise<void>
  rendreEnvois(idCommunication: number, idsJeunes: string[]): Promise<void>       // EN_COURS → A_ENVOYER
  compterEnvois(idCommunication: number): Promise<CommunicationEnvoi.Compteurs>
  enregistrerEchecDeLot(idCommunication: number): Promise<number>                // retourne le nouveau echecs_consecutifs
  reinitialiserEchecsDeLot(idCommunication: number): Promise<void>
  // Passe en statut terminal, pose envoi_termine_le et fige nb_envoyees / nb_erreurs / nb_tokens_invalides.
  terminerEnvoi(idCommunication: number, statut: Communication.StatutEnvoi.ENVOYEE | ANNULEE | EN_ERREUR, maintenant: DateTime): Promise<void>
  compterDestinataires(idPopulation: string, push: boolean): Promise<number>
  ```

- [ ] **Step 1 : Tests**

Dans `communication.repository.db.test.ts`, ajouter à la fin (le `beforeEach` existant crée `PILOTE` — conseiller `cite@ft.fr` → jeunes `jeuneDuConseillerCite`, `jeuneTransfere` — et `FT_CEJ` → `jeuneFtCej`, tous avec `pushNotificationToken: 'token'` via `unJeuneDto`) :

```ts
  describe('envoi des NOTIFICATION', () => {
    function uneNotificationAEnvoyer(
      surcharge: Partial<{ dateDebut: Date; statutEnvoi: Communication.StatutEnvoi | null; push: boolean; destinataire: Communication.Destinataire }> = {}
    ): Promise<CommunicationSqlModel> {
      return CommunicationSqlModel.create({
        ...uneCommunication({
          destinataire: Communication.Destinataire.JEUNE,
          type: Communication.Type.NOTIFICATION,
          dateFin: null,
          titre: 'Courte',
          contenu: 'Court'
        }),
        push: true,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
        ...surcharge
      })
    }

    describe('demarrerProchainEnvoi', () => {
      it('réclame la première communication due et fige les jeunes de la population avec token', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )
        const due = await uneNotificationAEnvoyer()
        await uneNotificationAEnvoyer({ dateDebut: demain })

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer?.id).to.equal(due.id)
        expect(aEnvoyer?.push).to.equal(true)
        const communication = await CommunicationSqlModel.findByPk(due.id)
        expect(communication!.statutEnvoi).to.equal(
          Communication.StatutEnvoi.EN_COURS
        )
        const envois = await CommunicationEnvoiSqlModel.findAll({
          where: { idCommunication: due.id },
          order: [['idJeune', 'ASC']]
        })
        expect(envois.map(e => e.idJeune)).to.deep.equal([
          'jeuneDuConseillerCite'
        ])
        expect(envois[0].statut).to.equal(CommunicationEnvoi.Statut.A_ENVOYER)
      })

      it('fige tous les jeunes de la population, même sans token, quand push est faux', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )
        const due = await uneNotificationAEnvoyer({ push: false })

        // When
        await repo.demarrerProchainEnvoi(maintenant)

        // Then
        const envois = await CommunicationEnvoiSqlModel.count({
          where: { idCommunication: due.id }
        })
        expect(envois).to.equal(2)
      })

      it('ignore les communications non dues, déjà démarrées, IN_APP ou sans push', async () => {
        // Given
        await uneNotificationAEnvoyer({ dateDebut: demain })
        await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.ANNULEE
        })
        await uneNotificationAEnvoyer({ push: null as unknown as boolean })
        await CommunicationSqlModel.create({
          ...uneCommunication(),
          statutEnvoi: null
        })

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer).to.equal(undefined)
        expect(await CommunicationEnvoiSqlModel.count()).to.equal(0)
      })
    })

    describe('recupererEnvoiEnCours', () => {
      it('renvoie la communication EN_COURS', async () => {
        // Given
        const enCours = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })
        await uneNotificationAEnvoyer()

        // When
        const resultat = await repo.recupererEnvoiEnCours()

        // Then
        expect(resultat?.id).to.equal(enCours.id)
        expect(resultat?.echecsConsecutifs).to.equal(0)
      })
    })

    describe('reserverEnvois / marquerEnvoi / rendreEnvois / compterEnvois', () => {
      let idCommunication: number

      beforeEach(async () => {
        const communication = await uneNotificationAEnvoyer({
          idPopulation: 'FT_CEJ'
        } as never)
        idCommunication = communication.id
        await CommunicationEnvoiSqlModel.bulkCreate(
          ['jeuneDuConseillerCite', 'jeuneFtCej', 'jeuneMilo'].map(
            idJeune => ({
              idCommunication,
              idJeune,
              statut: CommunicationEnvoi.Statut.A_ENVOYER,
              dateTraitement: null
            })
          )
        )
      })

      it('réserve les n premiers A_ENVOYER avec leur token, par id de jeune', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneFtCej' } }
        )

        // When
        const reserves = await repo.reserverEnvois(idCommunication, 2, maintenant)

        // Then
        expect(reserves).to.deep.equal([
          { idJeune: 'jeuneDuConseillerCite', token: 'token' },
          { idJeune: 'jeuneFtCej', token: null }
        ])
        const compteurs = await repo.compterEnvois(idCommunication)
        expect(compteurs).to.deep.equal({
          aEnvoyer: 1,
          enCours: 2,
          envoyees: 0,
          erreurs: 0,
          tokensInvalides: 0
        })
      })

      it('marque un envoi et rend les autres', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 3, maintenant)

        // When
        await repo.marquerEnvoi(
          idCommunication,
          'jeuneFtCej',
          CommunicationEnvoi.Statut.ENVOYEE,
          maintenant
        )
        await repo.rendreEnvois(idCommunication, [
          'jeuneDuConseillerCite',
          'jeuneMilo'
        ])

        // Then
        expect(await repo.compterEnvois(idCommunication)).to.deep.equal({
          aEnvoyer: 2,
          enCours: 0,
          envoyees: 1,
          erreurs: 0,
          tokensInvalides: 0
        })
      })

      it('libère les EN_COURS plus vieux que la date donnée', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 3, maintenant.minus({ hours: 1 }))

        // When
        const liberes = await repo.libererEnvoisBloques(
          idCommunication,
          maintenant.minus({ minutes: 30 })
        )

        // Then
        expect(liberes).to.equal(3)
        expect((await repo.compterEnvois(idCommunication)).aEnvoyer).to.equal(3)
      })
    })

    describe('terminerEnvoi', () => {
      it('pose le statut, la date et fige les totaux', async () => {
        // Given
        const communication = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })
        await CommunicationEnvoiSqlModel.bulkCreate([
          { idCommunication: communication.id, idJeune: 'jeuneDuConseillerCite', statut: CommunicationEnvoi.Statut.ENVOYEE },
          { idCommunication: communication.id, idJeune: 'jeuneFtCej', statut: CommunicationEnvoi.Statut.ERREUR },
          { idCommunication: communication.id, idJeune: 'jeuneMilo', statut: CommunicationEnvoi.Statut.TOKEN_INVALIDE }
        ])

        // When
        await repo.terminerEnvoi(
          communication.id,
          Communication.StatutEnvoi.ENVOYEE,
          maintenant
        )

        // Then
        const terminee = await CommunicationSqlModel.findByPk(communication.id)
        expect(terminee!.statutEnvoi).to.equal(Communication.StatutEnvoi.ENVOYEE)
        expect(terminee!.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
        expect(terminee!.nbEnvoyees).to.equal(1)
        expect(terminee!.nbErreurs).to.equal(1)
        expect(terminee!.nbTokensInvalides).to.equal(1)
      })
    })

    describe('enregistrerEchecDeLot', () => {
      it('incrémente et renvoie le compteur, que reinitialiserEchecsDeLot remet à zéro', async () => {
        // Given
        const communication = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })

        // When - Then
        expect(await repo.enregistrerEchecDeLot(communication.id)).to.equal(1)
        expect(await repo.enregistrerEchecDeLot(communication.id)).to.equal(2)
        await repo.reinitialiserEchecsDeLot(communication.id)
        expect(
          (await CommunicationSqlModel.findByPk(communication.id))!
            .echecsConsecutifs
        ).to.equal(0)
      })
    })

    describe('compterDestinataires', () => {
      it('compte les jeunes de la population, avec token seulement si push', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )

        // When - Then
        expect(await repo.compterDestinataires('PILOTE', true)).to.equal(1)
        expect(await repo.compterDestinataires('PILOTE', false)).to.equal(2)
      })
    })
  })
```

Imports à ajouter : `CommunicationEnvoi`, `CommunicationEnvoiSqlModel`. Le helper `uneCommunication` du fichier n'accepte pas `idPopulation` dans sa surcharge typée — l'étendre (ajouter `idPopulation: string` à son `Partial`) plutôt que caster.

- [ ] **Step 2 : Vérifier l'échec**

Run: `TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/infrastructure/repositories/communication.repository.db.test.ts --exit --timeout 10000`
Expected: FAIL — méthodes inexistantes.

- [ ] **Step 3 : Interface domaine**

Dans `Communication.Repository` (`src/domain/communication.ts`), ajouter les signatures listées dans **Interfaces** (importer `CommunicationEnvoi` depuis `./communication-envoi`).

- [ ] **Step 4 : Implémentation**

Dans `communication.repository.db.ts` (imports : `QueryTypes`, `Sequelize`, `Transaction` de `sequelize` ; `CommunicationEnvoi` ; `CommunicationSqlModel` ; `CommunicationEnvoiSqlModel` ; `sqlJoinConseillerDeReference` de `./sql-helpers`) :

```ts
  async recupererEnvoiEnCours(): Promise<Communication.AEnvoyer | undefined> {
    const communication = await CommunicationSqlModel.findOne({
      where: { statutEnvoi: Communication.StatutEnvoi.EN_COURS },
      order: [['dateDebut', 'ASC']]
    })
    return communication ? toAEnvoyer(communication) : undefined
  }

  async demarrerProchainEnvoi(
    maintenant: DateTime
  ): Promise<Communication.AEnvoyer | undefined> {
    return this.sequelize.transaction(async transaction => {
      const reclamees = await this.sequelize.query<{ id: number }>(
        `
          UPDATE communication SET statut_envoi = :enCours
          WHERE id = (
            SELECT id FROM communication
            WHERE type = :type AND statut_envoi = :aEnvoyer
              AND destinataire = :destinataire AND push IS NOT NULL
              AND date_debut <= :maintenant
            ORDER BY date_debut ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id
        `,
        {
          replacements: {
            enCours: Communication.StatutEnvoi.EN_COURS,
            aEnvoyer: Communication.StatutEnvoi.A_ENVOYER,
            type: Communication.Type.NOTIFICATION,
            destinataire: Communication.Destinataire.JEUNE,
            maintenant: maintenant.toJSDate()
          },
          type: QueryTypes.SELECT,
          transaction
        }
      )
      const reclamee = reclamees[0]
      if (!reclamee) return undefined

      const communication = (await CommunicationSqlModel.findByPk(reclamee.id, {
        transaction
      }))!
      await this.figerPopulation(communication, transaction)
      return toAEnvoyer(communication)
    })
  }

  private async figerPopulation(
    communication: CommunicationSqlModel,
    transaction: Transaction
  ): Promise<void> {
    const filtreToken = communication.push
      ? 'AND j.push_notification_token IS NOT NULL'
      : ''
    await this.sequelize.query(
      `
        INSERT INTO communication_envoi (id_communication, id_jeune, statut)
        SELECT :idCommunication, j.id, :aEnvoyer
        FROM jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
        WHERE ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
        ${filtreToken}
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          idCommunication: communication.id,
          idPopulation: communication.idPopulation,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER
        },
        type: QueryTypes.INSERT,
        transaction
      }
    )
  }

  async libererEnvoisBloques(
    idCommunication: number,
    avant: DateTime
  ): Promise<number> {
    const [, nombre] = await CommunicationEnvoiSqlModel.update(
      { statut: CommunicationEnvoi.Statut.A_ENVOYER, dateTraitement: null },
      {
        where: {
          idCommunication,
          statut: CommunicationEnvoi.Statut.EN_COURS,
          dateTraitement: { [Op.lt]: avant.toJSDate() }
        }
      }
    ) as unknown as [number, number]
    return nombre
  }
```

Attention : `Model.update` de sequelize-typescript renvoie `[affectedCount]` ; vérifier le type réel et ajuster (`const [nombre] = …`). Ne pas garder de cast inutile.

```ts
  async reserverEnvois(
    idCommunication: number,
    nombre: number,
    maintenant: DateTime
  ): Promise<Array<{ idJeune: string; token: string | null }>> {
    const rows = await this.sequelize.query<{
      id_jeune: string
      push_notification_token: string | null
    }>(
      `
        WITH reserves AS (
          UPDATE communication_envoi ce SET statut = :enCours, date_traitement = :maintenant
          WHERE (ce.id_communication, ce.id_jeune) IN (
            SELECT id_communication, id_jeune FROM communication_envoi
            WHERE id_communication = :idCommunication AND statut = :aEnvoyer
            ORDER BY id_jeune
            LIMIT :nombre
            FOR UPDATE SKIP LOCKED
          )
          RETURNING ce.id_jeune
        )
        SELECT r.id_jeune, j.push_notification_token
        FROM reserves r JOIN jeune j ON j.id = r.id_jeune
        ORDER BY r.id_jeune
      `,
      {
        replacements: {
          idCommunication,
          nombre,
          enCours: CommunicationEnvoi.Statut.EN_COURS,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => ({
      idJeune: row.id_jeune,
      token: row.push_notification_token
    }))
  }

  async marquerEnvoi(
    idCommunication: number,
    idJeune: string,
    statut: CommunicationEnvoi.Statut,
    maintenant: DateTime
  ): Promise<void> {
    await CommunicationEnvoiSqlModel.update(
      { statut, dateTraitement: maintenant.toJSDate() },
      { where: { idCommunication, idJeune } }
    )
  }

  async rendreEnvois(
    idCommunication: number,
    idsJeunes: string[]
  ): Promise<void> {
    if (idsJeunes.length === 0) return
    await CommunicationEnvoiSqlModel.update(
      { statut: CommunicationEnvoi.Statut.A_ENVOYER, dateTraitement: null },
      { where: { idCommunication, idJeune: idsJeunes } }
    )
  }

  async compterEnvois(
    idCommunication: number
  ): Promise<CommunicationEnvoi.Compteurs> {
    const rows = await this.sequelize.query<{ statut: CommunicationEnvoi.Statut; nombre: string }>(
      `
        SELECT statut, count(*) AS nombre
        FROM communication_envoi
        WHERE id_communication = :idCommunication
        GROUP BY statut
      `,
      { replacements: { idCommunication }, type: QueryTypes.SELECT }
    )
    const parStatut = new Map(rows.map(row => [row.statut, Number(row.nombre)]))
    const compter = (statut: CommunicationEnvoi.Statut): number =>
      parStatut.get(statut) ?? 0
    return {
      aEnvoyer: compter(CommunicationEnvoi.Statut.A_ENVOYER),
      enCours: compter(CommunicationEnvoi.Statut.EN_COURS),
      envoyees: compter(CommunicationEnvoi.Statut.ENVOYEE),
      erreurs: compter(CommunicationEnvoi.Statut.ERREUR),
      tokensInvalides: compter(CommunicationEnvoi.Statut.TOKEN_INVALIDE)
    }
  }

  async enregistrerEchecDeLot(idCommunication: number): Promise<number> {
    const rows = await this.sequelize.query<{ echecs_consecutifs: number }>(
      `
        UPDATE communication SET echecs_consecutifs = echecs_consecutifs + 1
        WHERE id = :idCommunication
        RETURNING echecs_consecutifs
      `,
      { replacements: { idCommunication }, type: QueryTypes.SELECT }
    )
    return rows[0].echecs_consecutifs
  }

  async reinitialiserEchecsDeLot(idCommunication: number): Promise<void> {
    await CommunicationSqlModel.update(
      { echecsConsecutifs: 0 },
      { where: { id: idCommunication } }
    )
  }

  async terminerEnvoi(
    idCommunication: number,
    statut:
      | Communication.StatutEnvoi.ENVOYEE
      | Communication.StatutEnvoi.ANNULEE
      | Communication.StatutEnvoi.EN_ERREUR,
    maintenant: DateTime
  ): Promise<void> {
    const compteurs = await this.compterEnvois(idCommunication)
    await CommunicationSqlModel.update(
      {
        statutEnvoi: statut,
        envoiTermineLe: maintenant.toJSDate(),
        nbEnvoyees: compteurs.envoyees,
        nbErreurs: compteurs.erreurs,
        nbTokensInvalides: compteurs.tokensInvalides
      },
      { where: { id: idCommunication } }
    )
  }

  async compterDestinataires(
    idPopulation: string,
    push: boolean
  ): Promise<number> {
    const filtreToken = push ? 'AND j.push_notification_token IS NOT NULL' : ''
    const rows = await this.sequelize.query<{ nombre: string }>(
      `
        SELECT count(*) AS nombre
        FROM jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
        WHERE ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
        ${filtreToken}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return Number(rows[0].nombre)
  }
```

Hors classe :

```ts
function toAEnvoyer(communication: CommunicationSqlModel): Communication.AEnvoyer {
  return {
    id: communication.id,
    idPopulation: communication.idPopulation,
    titre: communication.titre,
    contenu: communication.contenu,
    typeNotification: communication.typeNotification ?? undefined,
    push: communication.push!,
    echecsConsecutifs: communication.echecsConsecutifs
  }
}
```

Notes d'implémentation :
- `UPDATE … RETURNING` via `sequelize.query` avec `QueryTypes.SELECT` : Sequelize renvoie directement les lignes du `RETURNING` (même approche pour `enregistrerEchecDeLot`).
- `FOR UPDATE SKIP LOCKED` sur la sous-requête de réclamation : évite que deux ticks simultanés réclament la même communication ; le `WHERE statut_envoi = A_ENVOYER` dans la sous-requête suffit à ce que le second ne trouve rien.

- [ ] **Step 5 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/infrastructure/repositories/communication.repository.db.test.ts --exit --timeout 10000`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/domain/communication.ts src/infrastructure/repositories/communication.repository.db.ts test/infrastructure/repositories/communication.repository.db.test.ts
git commit -m "feat(communications): repository d'envoi — réclamer, figer, réserver, marquer, compter"
```

---

### Task 5 : Cron `ENVOYER_COMMUNICATIONS`

**Files:**
- Modify: `src/config/configuration.ts` (`jobs.envoiCommunications`), `test/utils/test-config.ts`
- Modify: `src/domain/planificateur.ts` (`JobType.ENVOYER_COMMUNICATIONS` remplace `NOTIFIER_COMMUNICATIONS`, cron)
- Modify: `src/domain/suivi-job.ts` (exclusions), `src/building-blocks/types/job-handler.ts` (tick silencieux)
- Create: `src/application/jobs/envoyer-communications.job.handler.db.ts`
- Modify: `src/app.module.ts`
- Test: `test/application/jobs/envoyer-communications.job.handler.db.test.ts`, `test/domain/suivi-job.test.ts` (s'il existe)

**Interfaces:**
- Consumes : tout le `Communication.Repository` de la Task 4, `Notification.Repository.send` de la Task 3.
- Produces :
  ```ts
  config jobs.envoiCommunications = { actif: boolean; tailleLot: string }   // env ENVOI_COMMUNICATIONS_ACTIF (défaut 'true'), ENVOI_COMMUNICATIONS_TAILLE_LOT (défaut '300')
  SuiviJob.silencieux?: boolean   // true → JobHandler.execute ne logue pas handler_executed
  Planificateur.JobType.ENVOYER_COMMUNICATIONS, cron '* 8-16 * * 1-5'
  ```

- [ ] **Step 1 : Config et planificateur**

`configuration.ts`, dans `jobs` :

```ts
      envoiCommunications: {
        actif: process.env.ENVOI_COMMUNICATIONS_ACTIF !== 'false',
        tailleLot: process.env.ENVOI_COMMUNICATIONS_TAILLE_LOT ?? '300'
      }
```

`test/utils/test-config.ts`, dans `jobs` : `envoiCommunications: { actif: true, tailleLot: '300' }`.

`planificateur.ts` : remplacer `NOTIFIER_COMMUNICATIONS = 'NOTIFIER_COMMUNICATIONS'` par `ENVOYER_COMMUNICATIONS = 'ENVOYER_COMMUNICATIONS'` ; remplacer l'entrée du tableau de crons par :

```ts
  {
    type: Planificateur.JobType.ENVOYER_COMMUNICATIONS,
    expression: '* 8-16 * * 1-5',
    description:
      'Toutes les minutes, 8h-17h jours ouvrés. Envoie un lot de la communication NOTIFICATION en cours, ou démarre la prochaine due.'
  },
```

`suivi-job.ts` : ajouter `Planificateur.JobType.ENVOYER_COMMUNICATIONS` aux deux listes (`estJobSuivi` et `estNotifiable`). S'il existe un test qui liste les jobs exclus, l'adapter.

`suivi-job.ts`, interface `SuiviJob` : ajouter `silencieux?: boolean`.

`job-handler.ts`, dans `execute`, remplacer `this.logExecution(startNs, suiviJob, undefined)` par :

```ts
      if (!suiviJob.silencieux) {
        this.logExecution(startNs, suiviJob, undefined)
      }
```

- [ ] **Step 2 : Tests du job**

`test/application/jobs/envoyer-communications.job.handler.db.test.ts` — test DB (le repository réel sur la base de test, `notificationRepository` stubbé) :

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { expect } from 'chai'
import { SinonSandbox } from 'sinon'
import { EnvoyerCommunicationsJobHandler } from '../../../src/application/jobs/envoyer-communications.job.handler.db'
import { Communication } from '../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../src/domain/communication-envoi'
import { Notification } from '../../../src/domain/notification/notification'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationEnvoiSqlModel } from '../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { Core } from '../../../src/domain/core'
import { Profil } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { createSandbox, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import { testConfig } from '../../utils/test-config'

const maintenant = uneDatetime()
const hier = maintenant.minus({ days: 1 }).toJSDate()

describe('EnvoyerCommunicationsJobHandler', () => {
  let handler: EnvoyerCommunicationsJobHandler
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let notificationRepository: StubbedType<Notification.Repository>
  let sandbox: SinonSandbox

  beforeEach(async () => {
    await getDatabase().cleanPG()
    sandbox = createSandbox()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    notificationRepository = stubInterface(sandbox)
    notificationRepository.send.resolves(Notification.ResultatEnvoi.ENVOYEE)

    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'conseiller', structure: Core.Structure.POLE_EMPLOI })
    )
    await JeuneSqlModel.bulkCreate(
      ['jeune1', 'jeune2', 'jeune3'].map(id =>
        unJeuneDto({
          id,
          idConseiller: 'conseiller',
          structure: Core.Structure.POLE_EMPLOI,
          pushNotificationToken: `token-${id}`
        })
      )
    )
    await PopulationSqlModel.create({ id: 'FT_CEJ', description: null })
    await PopulationProfilSqlModel.create({
      idPopulation: 'FT_CEJ',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.CEJ
    })

    handler = new EnvoyerCommunicationsJobHandler(
      suiviJobService,
      dateService,
      new CommunicationSqlRepository(getDatabase().sequelize),
      notificationRepository,
      testConfig()
    )
  })

  afterEach(() => sandbox.reset())

  function uneNotification(
    surcharge: Partial<{ statutEnvoi: Communication.StatutEnvoi; push: boolean; echecsConsecutifs: number }> = {}
  ): Promise<CommunicationSqlModel> {
    return CommunicationSqlModel.create({
      idPopulation: 'FT_CEJ',
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      dateDebut: hier,
      dateFin: null,
      titre: 'Courte',
      contenu: 'Court',
      statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
      ...surcharge
    })
  }

  it('ne fait rien, silencieusement, sans communication due', async () => {
    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.silencieux).to.equal(true)
    expect(notificationRepository.send).not.to.have.been.called()
  })

  it('démarre la communication due sans encore envoyer', async () => {
    // Given
    const communication = await uneNotification()

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.silencieux).to.equal(undefined)
    expect(
      (await CommunicationSqlModel.findByPk(communication.id))!.statutEnvoi
    ).to.equal(Communication.StatutEnvoi.EN_COURS)
    expect(await CommunicationEnvoiSqlModel.count()).to.equal(3)
    expect(notificationRepository.send).not.to.have.been.called()
  })

  it('envoie un lot de la communication en cours et marque chaque jeune', async () => {
    // Given
    const communication = await uneNotification()
    await handler.handle()
    notificationRepository.send
      .onSecondCall()
      .resolves(Notification.ResultatEnvoi.TOKEN_INVALIDE)

    // When
    const suivi = await handler.handle()

    // Then
    expect(notificationRepository.send).to.have.been.calledThrice()
    expect(notificationRepository.send.firstCall.args).to.deep.equal([
      {
        token: 'token-jeune1',
        notification: { title: 'Courte', body: 'Court' },
        data: { type: Notification.Type.MIGRATION_PARCOURS_EMPLOI }
      },
      'jeune1',
      true
    ])
    const envois = await CommunicationEnvoiSqlModel.findAll({
      order: [['idJeune', 'ASC']]
    })
    expect(envois.map(e => e.statut)).to.deep.equal([
      CommunicationEnvoi.Statut.ENVOYEE,
      CommunicationEnvoi.Statut.TOKEN_INVALIDE,
      CommunicationEnvoi.Statut.ENVOYEE
    ])
    expect(suivi.resultat).to.deep.equal({
      idCommunication: communication.id,
      envoyees: 2,
      erreurs: 0,
      tokensInvalides: 1,
      restantes: 0
    })
  })

  it('termine la communication quand il ne reste rien, en figeant les totaux', async () => {
    // Given
    const communication = await uneNotification()
    await handler.handle()
    await handler.handle()

    // When
    await handler.handle()

    // Then
    const terminee = (await CommunicationSqlModel.findByPk(communication.id))!
    expect(terminee.statutEnvoi).to.equal(Communication.StatutEnvoi.ENVOYEE)
    expect(terminee.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
    expect(terminee.nbEnvoyees).to.equal(3)
  })

  it('utilise CENTRE_DE_NOTIFS_UNIQUEMENT sans typeNotification et respecte push = false', async () => {
    // Given
    await uneNotification({ push: false })
    await CommunicationSqlModel.update({ typeNotification: null }, { where: {} })
    await handler.handle()

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send.firstCall.args[0].data.type).to.equal(
      Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
    )
    expect(notificationRepository.send.firstCall.args[2]).to.equal(false)
  })

  it('marque TOKEN_INVALIDE sans appeler Firebase pour un jeune sans token', async () => {
    // Given
    await uneNotification({ push: false })
    await JeuneSqlModel.update({ pushNotificationToken: null }, { where: { id: 'jeune2' } })
    await handler.handle()

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send).to.have.been.calledThrice()
  })
```

Attention au dernier test : avec `push = false`, un jeune sans token doit **quand même** être servi (centre de notifs). Le cas « token nul → `TOKEN_INVALIDE` sans appel » ne concerne que `push = true`, où le figement a déjà exclu les sans-token ; il reste possible si le token a été nullé **entre** le figement et le lot. Corriger le test ci-dessus en `push: true` + figement avant le `update` du token :

```ts
  it('marque TOKEN_INVALIDE sans appeler Firebase pour un jeune dont le token a disparu depuis le figement', async () => {
    // Given
    await uneNotification()
    await handler.handle()
    await JeuneSqlModel.update({ pushNotificationToken: null }, { where: { id: 'jeune2' } })

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send).to.have.been.calledTwice()
    const envoi = await CommunicationEnvoiSqlModel.findOne({ where: { idJeune: 'jeune2' } })
    expect(envoi!.statut).to.equal(CommunicationEnvoi.Statut.TOKEN_INVALIDE)
  })

  it('rend le lot et compte un échec quand tout le lot est en erreur, EN_ERREUR au troisième', async () => {
    // Given
    const communication = await uneNotification({ echecsConsecutifs: 2 })
    await handler.handle()
    notificationRepository.send.resolves(Notification.ResultatEnvoi.ERREUR)

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    expect((await handler['communicationRepository'].compterEnvois(communication.id)).aEnvoyer).to.equal(3)
    const enErreur = (await CommunicationSqlModel.findByPk(communication.id))!
    expect(enErreur.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_ERREUR)
    expect(enErreur.echecsConsecutifs).to.equal(3)
  })

  it('libère les envois bloqués depuis plus de 30 minutes avant de réserver', async () => {
    // Given
    const communication = await uneNotification({ statutEnvoi: Communication.StatutEnvoi.EN_COURS })
    await CommunicationEnvoiSqlModel.bulkCreate([
      { idCommunication: communication.id, idJeune: 'jeune1', statut: CommunicationEnvoi.Statut.EN_COURS, dateTraitement: maintenant.minus({ minutes: 31 }).toJSDate() },
      { idCommunication: communication.id, idJeune: 'jeune2', statut: CommunicationEnvoi.Statut.EN_COURS, dateTraitement: maintenant.minus({ minutes: 5 }).toJSDate() }
    ])

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send).to.have.been.calledOnce()
    expect(notificationRepository.send.firstCall.args[1]).to.equal('jeune1')
  })

  it('ne fait rien quand le kill switch est coupé', async () => {
    // Given
    await uneNotification()
    const config = testConfig()
    config.get('jobs').envoiCommunications.actif = false
    handler = new EnvoyerCommunicationsJobHandler(
      suiviJobService, dateService,
      new CommunicationSqlRepository(getDatabase().sequelize),
      notificationRepository, config
    )

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.silencieux).to.equal(true)
    expect(await CommunicationEnvoiSqlModel.count()).to.equal(0)
  })
})
```

(Remplacer `handler['communicationRepository']` par un `CommunicationSqlRepository` instancié dans le test — accéder à un membre privé n'est pas acceptable.)

- [ ] **Step 3 : Vérifier l'échec**

Run: `TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/envoyer-communications.job.handler.db.test.ts --exit --timeout 10000`
Expected: FAIL — handler inexistant.

- [ ] **Step 4 : Le job**

`src/application/jobs/envoyer-communications.job.handler.db.ts` :

```ts
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { CommunicationEnvoi } from '../../domain/communication-envoi'
import {
  Notification,
  NotificationRepositoryToken
} from '../../domain/notification/notification'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const MINUTES_AVANT_LIBERATION = 30
const ECHECS_CONSECUTIFS_MAX = 3

interface ResultatLot {
  idCommunication: number
  envoyees: number
  erreurs: number
  tokensInvalides: number
  restantes: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.ENVOYER_COMMUNICATIONS)
export class EnvoyerCommunicationsJobHandler extends JobHandler<void> {
  constructor(
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.ENVOYER_COMMUNICATIONS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { actif, tailleLot } = this.configService.get('jobs').envoiCommunications
    if (!actif) return this.rienAFaire(maintenant)

    const enCours = await this.communicationRepository.recupererEnvoiEnCours()
    if (enCours) {
      return this.envoyerUnLot(enCours, Number(tailleLot), maintenant)
    }

    const demarree = await this.communicationRepository.demarrerProchainEnvoi(maintenant)
    if (!demarree) return this.rienAFaire(maintenant)

    const compteurs = await this.communicationRepository.compterEnvois(demarree.id)
    rootLogger.info(
      {
        context: this.jobType,
        event: { action: 'communication_envoi_demarre', outcome: 'success' },
        communication: { id: demarree.id, idPopulation: demarree.idPopulation, nbDestinataires: compteurs.aEnvoyer }
      },
      'communication_envoi_demarre'
    )
    return this.suivi(maintenant, true, { idCommunication: demarree.id, nbDestinataires: compteurs.aEnvoyer })
  }

  private async envoyerUnLot(
    communication: Communication.AEnvoyer,
    tailleLot: number,
    maintenant: DateTime
  ): Promise<SuiviJob> {
    await this.communicationRepository.libererEnvoisBloques(
      communication.id,
      maintenant.minus({ minutes: MINUTES_AVANT_LIBERATION })
    )
    const reserves = await this.communicationRepository.reserverEnvois(
      communication.id,
      tailleLot,
      maintenant
    )
    if (reserves.length === 0) {
      return this.terminerSiPlusRien(communication, maintenant)
    }

    const resultat: ResultatLot = { idCommunication: communication.id, envoyees: 0, erreurs: 0, tokensInvalides: 0, restantes: 0 }
    const enErreur: string[] = []
    for (const { idJeune, token } of reserves) {
      const statut = await this.envoyer(communication, idJeune, token)
      if (statut === CommunicationEnvoi.Statut.ERREUR) enErreur.push(idJeune)
      else await this.communicationRepository.marquerEnvoi(communication.id, idJeune, statut, this.dateService.now())
      if (statut === CommunicationEnvoi.Statut.ENVOYEE) resultat.envoyees++
      if (statut === CommunicationEnvoi.Statut.ERREUR) resultat.erreurs++
      if (statut === CommunicationEnvoi.Statut.TOKEN_INVALIDE) resultat.tokensInvalides++
    }

    const lotEntierEnErreur = enErreur.length === reserves.length
    if (lotEntierEnErreur) {
      await this.communicationRepository.rendreEnvois(communication.id, enErreur)
      const echecs = await this.communicationRepository.enregistrerEchecDeLot(communication.id)
      if (echecs >= ECHECS_CONSECUTIFS_MAX) {
        await this.communicationRepository.terminerEnvoi(communication.id, Communication.StatutEnvoi.EN_ERREUR, this.dateService.now())
        this.loguerTransition(communication.id, 'communication_envoi_en_erreur', 'failure')
      }
    } else {
      for (const idJeune of enErreur) {
        await this.communicationRepository.marquerEnvoi(communication.id, idJeune, CommunicationEnvoi.Statut.ERREUR, this.dateService.now())
      }
      await this.communicationRepository.reinitialiserEchecsDeLot(communication.id)
    }

    resultat.restantes = (await this.communicationRepository.compterEnvois(communication.id)).aEnvoyer
    rootLogger.info(
      {
        context: this.jobType,
        event: { action: 'communication_lot_envoye', outcome: lotEntierEnErreur ? 'failure' : 'success' },
        communication: { id: communication.id },
        lot: resultat
      },
      'communication_lot_envoye'
    )
    return this.suivi(maintenant, !lotEntierEnErreur, resultat, resultat.erreurs)
  }

  private async envoyer(
    communication: Communication.AEnvoyer,
    idJeune: string,
    token: string | null
  ): Promise<CommunicationEnvoi.Statut> {
    if (communication.push && !token) return CommunicationEnvoi.Statut.TOKEN_INVALIDE
    try {
      const resultat = await this.notificationRepository.send(
        {
          token: token ?? '',
          notification: { title: communication.titre, body: communication.contenu },
          data: {
            // Absent, ce type ne redirige nulle part côté app.
            type: communication.typeNotification ?? Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
          }
        },
        idJeune,
        communication.push
      )
      return STATUT_PAR_RESULTAT[resultat]
    } catch (e) {
      rootLogger.error(
        {
          context: this.jobType,
          event: { action: 'communication_notification_envoyee', outcome: 'failure' },
          communication: { id: communication.id },
          jeune: { id: idJeune },
          error: toEcsError(e)
        },
        'communication_notification_envoyee'
      )
      return CommunicationEnvoi.Statut.ERREUR
    }
  }

  private async terminerSiPlusRien(
    communication: Communication.AEnvoyer,
    maintenant: DateTime
  ): Promise<SuiviJob> {
    const compteurs = await this.communicationRepository.compterEnvois(communication.id)
    if (compteurs.enCours > 0) return this.rienAFaire(maintenant)
    await this.communicationRepository.terminerEnvoi(communication.id, Communication.StatutEnvoi.ENVOYEE, maintenant)
    this.loguerTransition(communication.id, 'communication_envoi_termine', 'success')
    return this.suivi(maintenant, true, { idCommunication: communication.id, ...compteurs })
  }

  private loguerTransition(idCommunication: number, action: string, outcome: 'success' | 'failure'): void {
    rootLogger[outcome === 'success' ? 'info' : 'error'](
      { context: this.jobType, event: { action, outcome }, communication: { id: idCommunication } },
      action
    )
  }

  private rienAFaire(maintenant: DateTime): SuiviJob {
    return { ...this.suivi(maintenant, true, undefined), silencieux: true }
  }

  private suivi(maintenant: DateTime, succes: boolean, resultat: unknown, nbErreurs = 0): SuiviJob {
    return {
      jobType: this.jobType,
      dateExecution: maintenant,
      succes,
      resultat,
      nbErreurs,
      tempsExecution: DateService.calculerTempsExecution(maintenant)
    }
  }
}

const STATUT_PAR_RESULTAT: Record<Notification.ResultatEnvoi, CommunicationEnvoi.Statut> = {
  [Notification.ResultatEnvoi.ENVOYEE]: CommunicationEnvoi.Statut.ENVOYEE,
  [Notification.ResultatEnvoi.TOKEN_INVALIDE]: CommunicationEnvoi.Statut.TOKEN_INVALIDE,
  [Notification.ResultatEnvoi.ERREUR]: CommunicationEnvoi.Statut.ERREUR
}
```

Formater avec Prettier (les lignes longues ci-dessus seront reprises). Le log par jeune en erreur Firebase est déjà émis par `FirebaseClient.send` (`logger.error` + APM) : ne pas le doubler ici, le `catch` ne couvre que les exceptions hors Firebase.

Enregistrer `EnvoyerCommunicationsJobHandler` dans `src/app.module.ts` (import + liste des jobs, là où était `NotifierCommunicationsJobHandler`). Vérifier que `NotificationRepositoryToken` est bien le token exporté par `notification.ts` (sinon prendre le nom réel, cf. `notifier-beneficiaires.job.handler.db.ts`).

- [ ] **Step 5 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/envoyer-communications.job.handler.db.test.ts --exit --timeout 10000 && yarn test:local:unit -- --grep 'SuiviJob|JobHandler|Planificateur'`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add -A src test
git commit -m "feat(communications): cron ENVOYER_COMMUNICATIONS par lots"
```

---

### Task 6 : Commands support — statut initial, garde-fous, annulation

**Files:**
- Modify: `src/application/commands/support/creer-communication.command.handler.db.ts`, `modifier-communication.command.handler.db.ts`, `supprimer-communication.command.handler.db.ts`
- Create: `src/application/commands/support/annuler-envoi-communication.command.handler.db.ts`
- Modify: `src/infrastructure/routes/support-deploiements.controller.ts`, `src/app.module.ts`
- Test: `test/application/commands/support/communications.command.handlers.db.test.ts`, `test/infrastructure/routes/support-deploiements.controller.test.ts`

**Interfaces:**
- Produces :
  ```ts
  AnnulerEnvoiCommunicationCommand { id: number }
  AnnulerEnvoiCommunicationCommandHandler.handle(command): Promise<Result>   // EN_COURS → ANNULEE via terminerEnvoi ; 404 inconnue ; 400 autre statut
  POST /support/communications/:idCommunication/envoi/annulation → 204
  ```

- [ ] **Step 1 : Tests handlers**

Dans `communications.command.handlers.db.test.ts` :

- `CreerCommunicationCommandHandler : communication NOTIFICATION` → ajouter `expect(communication!.statutEnvoi).to.equal(Communication.StatutEnvoi.A_ENVOYER)` dans « crée la communication avec son typeNotification » ; et dans le `describe` `IN_APP`, `expect(communication!.statutEnvoi).to.be.null()`.
- `ModifierCommunicationCommandHandler` : 

```ts
    it("refuse de modifier une communication dont l'envoi a démarré", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.EN_COURS
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Autre',
        contenu: 'Court',
        dateFin: undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      expect((await CommunicationSqlModel.findByPk(communication.id))!.titre).to.equal('Courte')
    })
```

- `SupprimerCommunicationCommandHandler` : même test, « refuse de supprimer une communication dont l'envoi a démarré » (la ligne existe encore après).
- Nouveau `describe('AnnulerEnvoiCommunicationCommandHandler')` avec `new AnnulerEnvoiCommunicationCommandHandler(new CommunicationSqlRepository(getDatabase().sequelize), dateService)` :

```ts
    it("annule l'envoi en cours et fige les totaux", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({ …NOTIFICATION EN_COURS… })
      await CommunicationEnvoiSqlModel.bulkCreate([
        { idCommunication: communication.id, idJeune: 'jeune1', statut: CommunicationEnvoi.Statut.ENVOYEE },
        { idCommunication: communication.id, idJeune: 'jeune2', statut: CommunicationEnvoi.Statut.A_ENVOYER }
      ])

      // When
      const result = await handler.handle({ id: communication.id })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const annulee = (await CommunicationSqlModel.findByPk(communication.id))!
      expect(annulee.statutEnvoi).to.equal(Communication.StatutEnvoi.ANNULEE)
      expect(annulee.nbEnvoyees).to.equal(1)
      expect(annulee.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
    })

    it('refuse une communication qui n’est pas EN_COURS', async () => { /* A_ENVOYER → MauvaiseCommandeError */ })
    it("renvoie NonTrouveError quand la communication n'existe pas", async () => { … })
```

(Créer les jeunes `jeune1` / `jeune2` avec `unJeuneDto` + un conseiller dans le `beforeEach` de ce `describe` — FK.)

- [ ] **Step 2 : Vérifier l'échec**

Run: `TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/commands/support/communications.command.handlers.db.test.ts --exit --timeout 10000`
Expected: FAIL.

- [ ] **Step 3 : Handlers**

`creer-communication.command.handler.db.ts`, dans le `create` :

```ts
      statutEnvoi:
        communication.type === Communication.Type.NOTIFICATION
          ? Communication.StatutEnvoi.A_ENVOYER
          : null
```

`modifier-communication.command.handler.db.ts`, après le `findByPk` :

```ts
    if (!Communication.estModifiable(existante.statutEnvoi)) {
      return failure(
        new MauvaiseCommandeError(
          "Une communication dont l'envoi a démarré ne peut plus être modifiée"
        )
      )
    }
```

(Le `PUT` ne touche pas `statutEnvoi` : ne pas l'ajouter à l'`update`. Une communication qui passe de `IN_APP` à `NOTIFICATION` par `PUT` doit recevoir `A_ENVOYER`, et l'inverse `null` : ajouter `statutEnvoi: communication.type === NOTIFICATION ? A_ENVOYER : null` à l'`update` — c'est sans effet quand le type ne change pas puisqu'on n'est modifiable qu'en `A_ENVOYER`/`null`.)

`supprimer-communication.command.handler.db.ts` : `findByPk` d'abord ; 404 si absente ; `estModifiable` sinon 400 ; puis `destroy`.

`annuler-envoi-communication.command.handler.db.ts` :

```ts
@Injectable()
export class AnnulerEnvoiCommunicationCommandHandler extends CommandHandler<
  AnnulerEnvoiCommunicationCommand,
  void
> {
  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    private readonly dateService: DateService
  ) {
    super('AnnulerEnvoiCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> { return emptySuccess() }
  async monitor(): Promise<void> { return }

  async handle(command: AnnulerEnvoiCommunicationCommand): Promise<Result> {
    const communication = await CommunicationSqlModel.findByPk(command.id)
    if (!communication) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    if (communication.statutEnvoi !== Communication.StatutEnvoi.EN_COURS) {
      return failure(
        new MauvaiseCommandeError("Seul un envoi EN_COURS peut être annulé")
      )
    }
    await this.communicationRepository.terminerEnvoi(
      command.id,
      Communication.StatutEnvoi.ANNULEE,
      this.dateService.now()
    )
    return emptySuccess()
  }
}
```

- [ ] **Step 4 : Route**

Dans `support-deploiements.controller.ts`, après le `DELETE communications/:idCommunication` :

```ts
  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: "Annule l'envoi en cours d'une communication NOTIFICATION",
    description:
      'Kill switch : le cron ENVOYER_COMMUNICATIONS ne traite plus cette communication (un lot déjà en vol finit ses envois). Les jeunes déjà notifiés le restent ; pas de relance possible, créer une nouvelle communication.'
  })
  @ApiParam({ name: 'idCommunication', example: 3 })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Annulée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "L'envoi n'est pas EN_COURS" })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'La communication n’existe pas' })
  @Post('communications/:idCommunication/envoi/annulation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async annulerEnvoiCommunication(
    @Param('idCommunication', ParseIntPipe) idCommunication: number
  ): Promise<void> {
    const result = await this.annulerEnvoiCommunicationCommandHandler.execute(
      { id: idCommunication },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }
```

Injecter le handler dans le constructeur, l'enregistrer dans `app.module.ts`. Mettre à jour la description Swagger du `PUT` et du `DELETE` : « Refusé (400) dès que l'envoi d'une NOTIFICATION a démarré ». Test controller : un `it` par route (204 quand le handler réussit ; 400 sur `MauvaiseCommandeError`), sur le modèle des tests `DELETE communications` existants.

- [ ] **Step 5 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:db -- --grep 'Communications' && yarn test:local:unit -- --grep 'SupportDeploiementsController'`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add -A src test
git commit -m "feat(communications): garde-fous PUT/DELETE et annulation d'un envoi"
```

---

### Task 7 : Suivi dans `GET /support/populations/:id`

**Files:**
- Modify: `src/application/queries/query-models/population-support.query-model.ts`
- Modify: `src/application/queries/get-population-support.query.handler.db.ts`
- Test: `test/application/queries/get-population-support.query.handler.db.test.ts`

**Interfaces:**
- Produces :
  ```ts
  CommunicationSupportQueryModel.statutEnvoi?: Communication.StatutEnvoi
  CommunicationSupportQueryModel.envoiTermineLe?: string
  CommunicationSupportQueryModel.nbDestinataires?: number        // A_ENVOYER seulement : count vivant
  CommunicationSupportQueryModel.envoi?: EnvoiCommunicationQueryModel  // { envoyees, erreurs, tokensInvalides, aEnvoyer?, enCours? } — EN_COURS : compteurs vivants ; terminal : totaux figés
  ```

- [ ] **Step 1 : Tests**

Dans `get-population-support.query.handler.db.test.ts` (le handler reçoit désormais `new CommunicationSqlRepository(getDatabase().sequelize)` en constructeur) :

```ts
    it('expose nbDestinataires pour une NOTIFICATION à envoyer', async () => {
      // Given : un jeune avec token dans la population, un sans
      …
      // Then
      expect(model.communications[0].statutEnvoi).to.equal(Communication.StatutEnvoi.A_ENVOYER)
      expect(model.communications[0].nbDestinataires).to.equal(1)
      expect(model.communications[0].envoi).to.equal(undefined)
    })

    it("expose les compteurs vivants d'une NOTIFICATION en cours", async () => {
      // Given : EN_COURS + 2 lignes communication_envoi (ENVOYEE, A_ENVOYER)
      // Then
      expect(model.communications[0].envoi).to.deep.equal({ aEnvoyer: 1, enCours: 0, envoyees: 1, erreurs: 0, tokensInvalides: 0 })
      expect(model.communications[0].nbDestinataires).to.equal(undefined)
    })

    it("expose les totaux figés d'une NOTIFICATION terminée", async () => {
      // Given : ENVOYEE, envoiTermineLe, nbEnvoyees 3, nbErreurs 1, nbTokensInvalides 0, aucune ligne détail (purgée)
      // Then
      expect(model.communications[0].envoiTermineLe).to.equal('2026-10-01T09:54:00.000Z')
      expect(model.communications[0].envoi).to.deep.equal({ envoyees: 3, erreurs: 1, tokensInvalides: 0 })
    })

    it("n'expose rien de l'envoi pour une IN_APP", …)
```

Écrire les `Given` complets (conseiller, jeunes, population, profil — comme dans `communication.repository.db.test.ts`).

- [ ] **Step 2 : Query model**

```ts
export class EnvoiCommunicationQueryModel {
  @ApiPropertyOptional({ description: 'EN_COURS seulement' })
  aEnvoyer?: number

  @ApiPropertyOptional({ description: 'EN_COURS seulement' })
  enCours?: number

  @ApiProperty()
  envoyees: number

  @ApiProperty()
  erreurs: number

  @ApiProperty()
  tokensInvalides: number
}
```

Dans `CommunicationSupportQueryModel` :

```ts
  @ApiPropertyOptional({ enum: Communication.StatutEnvoi, description: 'NOTIFICATION seulement. A_ENVOYER → EN_COURS → ENVOYEE | ANNULEE | EN_ERREUR.' })
  statutEnvoi?: Communication.StatutEnvoi

  @ApiPropertyOptional({ description: 'Fin de l’envoi (ENVOYEE, ANNULEE ou EN_ERREUR), en UTC' })
  envoiTermineLe?: string

  @ApiPropertyOptional({ description: 'A_ENVOYER seulement : nombre de jeunes qui recevront la notification si elle partait maintenant (avec token si push). À relire avant dateDebut pour vérifier le ciblage.' })
  nbDestinataires?: number

  @ApiPropertyOptional({ type: EnvoiCommunicationQueryModel, description: 'EN_COURS : compteurs vivants. Terminée : totaux figés (le détail par jeune est purgé après 30 jours).' })
  envoi?: EnvoiCommunicationQueryModel
```

- [ ] **Step 3 : Handler**

Injecter `@Inject(CommunicationRepositoryToken) communicationRepository: Communication.Repository`. Après le `Promise.all`, pour chaque communication `NOTIFICATION`, calculer :

```ts
    const envois = await Promise.all(
      communications.map(co => this.envoiDe(co))
    )
```

```ts
  private async envoiDe(co: CommunicationSqlModel): Promise<Pick<CommunicationSupportQueryModel, 'nbDestinataires' | 'envoi'>> {
    switch (co.statutEnvoi) {
      case Communication.StatutEnvoi.A_ENVOYER:
        return { nbDestinataires: await this.communicationRepository.compterDestinataires(co.idPopulation, co.push!) }
      case Communication.StatutEnvoi.EN_COURS:
        return { envoi: await this.communicationRepository.compterEnvois(co.id) }
      case Communication.StatutEnvoi.ENVOYEE:
      case Communication.StatutEnvoi.ANNULEE:
      case Communication.StatutEnvoi.EN_ERREUR:
        return { envoi: { envoyees: co.nbEnvoyees ?? 0, erreurs: co.nbErreurs ?? 0, tokensInvalides: co.nbTokensInvalides ?? 0 } }
      default:
        return {}
    }
  }
```

et dans le mapping : `statutEnvoi: co.statutEnvoi ?? undefined`, `envoiTermineLe: co.envoiTermineLe ? DateTime.fromJSDate(co.envoiTermineLe).toUTC().toISO()! : undefined`, `...envois[index]`.

- [ ] **Step 4 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/queries/get-population-support.query.handler.db.test.ts --exit --timeout 10000 && yarn test:local:unit -- --grep 'SupportDeploiementsController'`
Expected: PASS (le test controller stubbe le handler : vérifier l'instanciation dans le `beforeEach` si le constructeur a changé).

- [ ] **Step 5 : Commit**

```bash
git add -A src test
git commit -m "feat(communications): suivi de l'envoi dans GET /support/populations/:id"
```

---

### Task 8 : Purge du détail à 30 jours

**Files:**
- Modify: `src/application/jobs/nettoyer-les-donnees.job.handler.db.ts`
- Test: `test/application/jobs/nettoyer-les-donnees.job.handler.db.test.ts`

- [ ] **Step 1 : Test**

Sur le modèle du test `nombreNotificationsJeuneSupprimes` (ligne ~617) :

```ts
    it('supprime le détail des envois de communications terminées depuis plus de 30 jours', async () => {
      // Given : communication A (ENVOYEE, envoiTermineLe il y a 31 j) avec 2 lignes, communication B (ENVOYEE il y a 10 j) avec 1 ligne, communication C (EN_COURS) avec 1 ligne
      // When
      const stats = await handler.handle()
      // Then
      expect(await CommunicationEnvoiSqlModel.count()).to.equal(2)
      expect((stats.resultat as { nombreEnvoisCommunicationSupprimes: number }).nombreEnvoisCommunicationSupprimes).to.equal(2)
    })
```

- [ ] **Step 2 : Implémentation**

Un compteur `nombreEnvoisCommunicationSupprimes` (initialisé à `-1` comme les autres), un bloc `try` :

```ts
    try {
      nombreEnvoisCommunicationSupprimes = await CommunicationEnvoiSqlModel.destroy({
        where: {
          idCommunication: {
            [Op.in]: sequelize.literal(`(
              SELECT id FROM communication
              WHERE statut_envoi IN ('ENVOYEE', 'ANNULEE', 'EN_ERREUR')
                AND envoi_termine_le < '${maintenant.minus({ days: 30 }).toISO()}'
            )`)
          }
        }
      })
    } catch (e) {
      this.logger.warn(e)
      nbErreurs++
    }
```

Préférer un `sequelize.query('DELETE FROM communication_envoi WHERE id_communication IN (SELECT …)', { replacements: { avant } })` si `Op.in` + `literal` est peu lisible — au choix, mais avec un paramètre lié plutôt qu'une date interpolée. Ajouter le compteur au `resultat`.

- [ ] **Step 3 : Vérifier et commiter**

Run: `yarn tsc --noEmit && yarn lint && TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/nettoyer-les-donnees.job.handler.db.test.ts --exit --timeout 10000`

```bash
git add -A src test
git commit -m "feat(communications): purge du détail des envois après 30 jours"
```

---

### Task 9 : Supprimer `NOTIFIER_BENEFICIAIRES` et la route support

**Files:**
- Delete: `src/application/commands/notifier-beneficiaires.command.handler.ts`, `src/application/jobs/notifier-beneficiaires.job.handler.db.ts`, `test/application/commands/notifier-beneficiaires.command.handler.test.ts`, `test/application/jobs/notifier-beneficiaires.job.handler.db.test.ts`
- Modify: `src/infrastructure/routes/support.controller.ts` (route + import + injection), `src/infrastructure/routes/validation/support.inputs.ts` (`NotifierBeneficiairesPayload`), `test/infrastructure/routes/support.controller.test.ts`
- Modify: `src/app.module.ts`
- Modify: `src/domain/planificateur.ts` (`JobType.NOTIFIER_BENEFICIAIRES`, `JobNotifierBeneficiaires`, `StatsJobNotif`, `ParamsJobNotif`, `Repository.recupererPremierJobNonTermine`)
- Modify: `src/domain/suivi-job.ts`, `src/infrastructure/repositories/planificateur-redis.repository.db.ts` + son test
- Modify: `docs/TROUBLESHOOT.md:28`

- [ ] **Step 1 : Supprimer et traquer**

```bash
git rm src/application/commands/notifier-beneficiaires.command.handler.ts \
       src/application/jobs/notifier-beneficiaires.job.handler.db.ts \
       test/application/commands/notifier-beneficiaires.command.handler.test.ts \
       test/application/jobs/notifier-beneficiaires.job.handler.db.test.ts
grep -rn "NotifierBeneficiaires\|NOTIFIER_BENEFICIAIRES\|notifier-beneficiaires\|NOTIFIER_COMMUNICATIONS\|StatsJobNotif\|ParamsJobNotif\|recupererPremierJobNonTermine\|recupererJobsNonTermines" src test docs --exclude-dir=superpowers --exclude-dir=decisions
```

Traiter chaque occurrence : route et bloc Swagger dans `support.controller.ts` (+ import, paramètre du constructeur), `NotifierBeneficiairesPayload` et imports devenus inutiles dans `support.inputs.ts`, tests correspondants, types et méthode d'interface dans `planificateur.ts`, implémentation et test dans le repository Redis (garder `MAX_NUMBER_REDIS_JOBS` s'il sert encore à `estEnCoursDeTraitement` / `compterLesJobs`), entrée d'`estJobSuivi`, ligne du `TROUBLESHOOT.md` (remplacer par `active -q '[.root[] | select(.data.type | contains("ENVOYER_COMMUNICATIONS"))]' -e 6000`). Le commentaire en tête de `communication.ts` (« Limites de NotifierBeneficiairesPayload ») devient « Le contenu d'une communication NOTIFICATION devient le titre et le corps de la notification push. »

- [ ] **Step 2 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:unit && yarn test:local:db -- --grep 'Planificateur|Support|Communication'`
Expected: PASS ; le `grep` ne renvoie plus rien.

- [ ] **Step 3 : Commit**

```bash
git add -A src test docs/TROUBLESHOOT.md
git commit -m "refactor(communications): suppression du job NOTIFIER_BENEFICIAIRES et de la route support"
```

---

### Task 10 : Documentation

**Files:**
- Modify: `docs/decisions/ADR-007-communications.md`
- Modify: `docs/TROUBLESHOOT.md`

- [ ] **Step 1 : ADR-007**

Réécrire la partie envoi à partir de la spec v2. Récupérer le raisonnement de la v1 de l'ADR (jamais mergée) pour ne pas le perdre — `git show 36f8c12f:docs/decisions/ADR-007-communications.md` (commit local sauté au rebase ; si perdu, la substance est : `typeNotification` pilote le deeplink, sans valeur par défaut côté API → `CENTRE_DE_NOTIFS_UNIQUEMENT` si absent ; `push` décide push ou centre de notifs seul ; point ouvert « push sans deeplink côté mobile »). À couvrir :

- Statut : « accepté, implémenté (conseillers, jeunes, envoi push) », date complétée le 2026-09-22.
- Décision 11 remplacée : « `NOTIFICATION` est envoyée par lots par un cron à la minute, pilotée par `statut_envoi` » — résumé du cycle de vie, une seule `EN_COURS`, lots fixes 300/min, pas de plafond (débordement), libération 30 min, lot en échec total rendu, `EN_ERREUR` à 3, pas de relance (trade-off), `PUT`/`DELETE` refusés hors `A_ENVOYER`, annulation.
- Décision : `typeNotification` optionnel, `push` obligatoire (v1).
- Modèle mermaid : `communication` avec `statut_envoi`, `envoi_termine_le`, `echecs_consecutifs`, `nb_*` ; `communication_envoi`.
- Routes : `POST …/envoi/annulation`, `GET /support/populations/:id` (`statutEnvoi`, `envoiTermineLe`, `nbDestinataires`, `envoi`).
- Exemple : reprendre l'exemple de la spec (nominal + variante crash).
- Livraison : troisième étape livrée ; procédure post-deploy (`yarn tasks:initialiser-les-crons`, vérification `SELECT count(*) FROM communication WHERE type = 'NOTIFICATION'` avant migration, première campagne sur population test).
- Hors ADR : relance, multicast, prévisualisation complète.
- Point ouvert : push sans deeplink côté mobile ; nuller `push_notification_token` sur `TOKEN_INVALIDE`.

- [ ] **Step 2 : TROUBLESHOOT.md**

Section « Communications NOTIFICATION » :
- Vérifier le cron : `yarn tasks:initialiser-les-crons` post-deploy ; ligne `active` ci-dessus.
- Kill switch : `ENVOI_COMMUNICATIONS_ACTIF=false` (Scalingo env, redémarre le worker) ; annulation par communication : `POST /support/communications/:id/envoi/annulation`.
- Suivre un envoi : `GET /support/populations/:id` ; Kibana `event.action: communication_lot_envoye` / `communication_envoi_*`.
- Lister les jeunes en erreur : `SELECT id_jeune, statut, date_traitement FROM communication_envoi WHERE id_communication = :id AND statut IN ('ERREUR', 'TOKEN_INVALIDE') ORDER BY date_traitement` (détail conservé 30 jours).
- Première campagne : créer une population de test (emails des conseillers de l'équipe), une `NOTIFICATION` dessus, relire `nbDestinataires`, attendre le cron, vérifier `envoi`.

- [ ] **Step 3 : Commit**

```bash
git add docs/decisions/ADR-007-communications.md docs/TROUBLESHOOT.md
git commit -m "docs: ADR-007 envoi des NOTIFICATION par lots, TROUBLESHOOT"
```

---

### Task 11 : Vérification finale

- [ ] **Step 1 : Tout**

Run: `yarn tsc --noEmit && yarn lint && yarn test`
Expected: PASS.

- [ ] **Step 2 : Relecture de la spec**

Cocher chaque ligne du tableau « Mise en production et garde-fous » de la spec contre le code : migration `ANNULEE`, filtre `destinataire = JEUNE AND push IS NOT NULL` (dans `demarrerProchainEnvoi`), kill switch, `nbDestinataires`, `SKIP LOCKED` ×2, libération 30 min, lot rendu, exclusions `suivi_job` / Mattermost, tick silencieux, purge 30 j.

- [ ] **Step 3 : `grep` final**

```bash
grep -rn "envoyee_le\|envoyeeLe\|NOTIFIER_BENEFICIAIRES\|NOTIFIER_COMMUNICATIONS\|ENVOYER_LOT_COMMUNICATION" src test docs --exclude-dir=superpowers
```

Expected : rien (les `docs/superpowers/` conservent l'historique).

---

## Self-review

- **Couverture spec** : modèle (Task 2), job unique et ses 3 branches (Task 5), `send` (Task 3), routes annulation + `GET` (Tasks 6-7), suppression (Task 9), nettoyage (Task 8), garde-fous (Tasks 2, 5, 6, 7), observabilité (Task 5 : logs ECS, exclusions, tick silencieux), doc (Task 10). Question ouverte « nuller le token » : consignée dans l'ADR (Task 10), pas implémentée.
- **Cohérence des noms** : `demarrerProchainEnvoi` / `recupererEnvoiEnCours` / `libererEnvoisBloques` / `reserverEnvois` / `marquerEnvoi` / `rendreEnvois` / `compterEnvois` / `enregistrerEchecDeLot` / `reinitialiserEchecsDeLot` / `terminerEnvoi` / `compterDestinataires` — identiques entre Task 4 (définition), Task 5 (job), Task 6 (annulation) et Task 7 (query). `SuiviJob.silencieux` défini en Task 5 et utilisé au même endroit. `Notification.ResultatEnvoi` (Task 3) consommé en Task 5 via `STATUT_PAR_RESULTAT`.
- **Ordre de compilation** : Task 2 supprime le cron v1 pour que `envoyeeLe` disparaisse proprement ; `JobType.NOTIFIER_COMMUNICATIONS` est renommé en Task 5, supprimé des dernières références en Task 9.

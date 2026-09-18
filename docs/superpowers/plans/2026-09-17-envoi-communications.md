# Envoi robuste des communications NOTIFICATION — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le job `NOTIFIER_BENEFICIAIRES` (un gros job par quart de population, sans reprise) par un envoi par lots courts piloté par l'état en base, avec suivi, annulation et relance côté support, puis supprimer la route `POST /support/notifier-beneficiaires`.

**Architecture:** La population d'une communication `NOTIFICATION` est figée dans une table `communication_envoi` (une ligne par jeune, statut). Un job `ENVOYER_LOT_COMMUNICATION` d'environ une minute traite les lignes `A_ENVOYER` à un débit calculé (restantes / fenêtre ouvrée restante, borné) et se replanifie lui-même. Le statut de la communication (`A_ENVOYER` → `EN_COURS` → `ENVOYEE` | `ANNULEE` | `EN_ERREUR`) remplace `envoyee_le` et pilote le cron, l'annulation et la relance.

**Tech Stack:** NestJS 11, Sequelize 6 (+ sequelize-typescript), Bull 4 / Redis, Luxon, Mocha + Chai + Sinon, tests DB avec `getDatabase()`.

**Spec:** `docs/superpowers/specs/2026-09-17-envoi-communications-design.md`

## Global Constraints

- Prettier : `semi: false`, `singleQuote: true`, `trailingComma: none`, `arrowParens: avoid`. String avec apostrophe → doubles guillemets.
- ESLint : pas de `console`, pas de `process.env` hors `configuration.ts`, types de retour explicites, pas de `any`.
- Pas de commentaires sauf fait non-évident, `// TODO:` actionnable, ou `// Given / When / Then`.
- Result monad : pas de `throw` métier, `failure(new MauvaiseCommandeError(...))`.
- Tests : `.test.ts` unitaires, `.db.test.ts` avec DB. Structure miroir `test/` ↔ `src/`.
- Vérifications avant chaque commit : `yarn tsc --noEmit` (pas `yarn build`, qui ne typecheck pas les tests), `yarn lint`, et les tests du périmètre (`yarn test:local:unit` / `yarn test:local:db -- --grep '<Nom>'`). Les tests DB nécessitent `yarn db:test`.
- Commits découpés par tâche, messages en français, préfixe `feat(communications):` / `refactor(communications):` / `docs:`, terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Timezone ouvrée : `TIME_ZONE_EUROPE_PARIS` de `src/config/configuration.ts`.
- **Plusieurs conteneurs `worker` en prod** : deux jobs peuvent tourner en parallèle sur deux workers. Toute lecture-puis-écriture sur `communication_envoi` doit être atomique (`UPDATE … RETURNING` + `FOR UPDATE SKIP LOCKED`), jamais `SELECT` puis `UPDATE`.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/infrastructure/sequelize/migrations/20260921000000-communication-statut-envoi.js` | colonnes `statut_envoi`, `envoi_termine_le`, suppression `envoyee_le`, table `communication_envoi` |
| `src/infrastructure/sequelize/models/communication.sql-model.ts` | remplace `envoyeeLe` par `statutEnvoi`, `envoiTermineLe` |
| `src/infrastructure/sequelize/models/communication-envoi.sql-model.ts` | nouveau modèle |
| `src/domain/communication.ts` | `StatutEnvoi`, transitions, `Repository` étendu |
| `src/domain/communication-envoi.ts` | statut par jeune, `calculerDebit`, `prochainCreneauOuvre` |
| `src/domain/notification/notification.ts` | `ResultatEnvoi`, `send` retourne le résultat |
| `src/infrastructure/clients/firebase-client.ts` | `send` retourne `ResultatEnvoi` |
| `src/infrastructure/repositories/notification-firebase.repository.db.ts` | awaite Firebase, retourne le résultat |
| `src/infrastructure/repositories/communication.repository.db.ts` | `figerPopulationAEnvoyer`, `reserverProchainsEnvois`, `libererEnvoisBloques`, `marquerEnvoi`, `compterEnvois` |
| `src/config/configuration.ts` | `jobs.envoiCommunication` |
| `src/domain/planificateur.ts` | `JobType.ENVOYER_LOT_COMMUNICATION`, `JobEnvoyerLotCommunication`, suppression `NOTIFIER_BENEFICIAIRES` |
| `src/application/jobs/envoyer-lot-communication.job.handler.db.ts` | nouveau job |
| `src/application/jobs/notifier-communications.job.handler.db.ts` | réécrit |
| `src/application/commands/support/annuler-envoi-communication.command.handler.db.ts` | nouveau |
| `src/application/commands/support/relancer-envoi-communication.command.handler.db.ts` | nouveau |
| `src/application/commands/support/{creer,modifier,supprimer}-communication.command.handler.db.ts` | statut initial, garde-fous |
| `src/application/queries/get-population-support.query.handler.db.ts` + `query-models/population-support.query-model.ts` | `statutEnvoi`, `envoiTermineLe`, `envoi` |
| `src/infrastructure/routes/support-deploiements.controller.ts` | 2 routes |
| `src/infrastructure/routes/support.controller.ts`, `validation/support.inputs.ts` | suppression route + payload |
| `src/application/commands/notifier-beneficiaires.command.handler.ts`, `src/application/jobs/notifier-beneficiaires.job.handler.db.ts` | supprimés |
| `docs/decisions/ADR-007-communications.md`, `docs/TROUBLESHOOT.md` | mise à jour |

---

### Task 1 : Domaine — statuts d'envoi et transitions

**Files:**
- Modify: `src/domain/communication.ts`
- Create: `src/domain/communication-envoi.ts`
- Test: `test/domain/communication.test.ts` (ajout d'un `describe`)

**Interfaces:**
- Produces:
  ```ts
  Communication.StatutEnvoi = 'A_ENVOYER' | 'EN_COURS' | 'ENVOYEE' | 'ANNULEE' | 'EN_ERREUR'
  Communication.demarrerEnvoi(statut: StatutEnvoi | null): Result<StatutEnvoi>   // A_ENVOYER → EN_COURS
  Communication.annulerEnvoi(statut: StatutEnvoi | null): Result<StatutEnvoi>    // EN_COURS → ANNULEE
  Communication.relancerEnvoi(statut: StatutEnvoi | null): Result<StatutEnvoi>   // ANNULEE | EN_ERREUR → EN_COURS
  Communication.estModifiable(statut: StatutEnvoi | null): boolean               // null ou A_ENVOYER
  CommunicationEnvoi.Statut = 'A_ENVOYER' | 'EN_COURS' | 'ENVOYEE' | 'ERREUR' | 'TOKEN_INVALIDE'
  ```

- [ ] **Step 1 : Écrire les tests des transitions**

Ajouter à la fin de `describe('Communication', …)` dans `test/domain/communication.test.ts` :

```ts
  describe('transitions du statut d’envoi', () => {
    it('demarrerEnvoi passe A_ENVOYER en EN_COURS', () => {
      const result = Communication.demarrerEnvoi(
        Communication.StatutEnvoi.A_ENVOYER
      )
      expect(isSuccess(result) && result.data).to.equal(
        Communication.StatutEnvoi.EN_COURS
      )
    })

    it('demarrerEnvoi refuse tout autre statut', () => {
      for (const statut of [
        null,
        Communication.StatutEnvoi.EN_COURS,
        Communication.StatutEnvoi.ENVOYEE,
        Communication.StatutEnvoi.ANNULEE,
        Communication.StatutEnvoi.EN_ERREUR
      ]) {
        const result = Communication.demarrerEnvoi(statut)
        expect(isFailure(result) && result.error).to.be.instanceOf(
          MauvaiseCommandeError
        )
      }
    })

    it('annulerEnvoi passe EN_COURS en ANNULEE et refuse le reste', () => {
      const ok = Communication.annulerEnvoi(Communication.StatutEnvoi.EN_COURS)
      expect(isSuccess(ok) && ok.data).to.equal(
        Communication.StatutEnvoi.ANNULEE
      )
      const ko = Communication.annulerEnvoi(Communication.StatutEnvoi.ENVOYEE)
      expect(isFailure(ko)).to.equal(true)
    })

    it('relancerEnvoi repart de ANNULEE ou EN_ERREUR, refuse le reste', () => {
      for (const statut of [
        Communication.StatutEnvoi.ANNULEE,
        Communication.StatutEnvoi.EN_ERREUR
      ]) {
        const result = Communication.relancerEnvoi(statut)
        expect(isSuccess(result) && result.data).to.equal(
          Communication.StatutEnvoi.EN_COURS
        )
      }
      for (const statut of [
        null,
        Communication.StatutEnvoi.A_ENVOYER,
        Communication.StatutEnvoi.EN_COURS,
        Communication.StatutEnvoi.ENVOYEE
      ]) {
        expect(isFailure(Communication.relancerEnvoi(statut))).to.equal(true)
      }
    })

    it('estModifiable seulement sans statut ou A_ENVOYER', () => {
      expect(Communication.estModifiable(null)).to.equal(true)
      expect(
        Communication.estModifiable(Communication.StatutEnvoi.A_ENVOYER)
      ).to.equal(true)
      expect(
        Communication.estModifiable(Communication.StatutEnvoi.EN_COURS)
      ).to.equal(false)
      expect(
        Communication.estModifiable(Communication.StatutEnvoi.ENVOYEE)
      ).to.equal(false)
    })
  })
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:unit -- --grep 'transitions du statut'`
Expected: FAIL — `Communication.StatutEnvoi` n'existe pas.

- [ ] **Step 3 : Implémenter dans `src/domain/communication.ts`**

Dans le namespace `Communication`, après `enum Type` :

```ts
  export enum StatutEnvoi {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ANNULEE = 'ANNULEE',
    EN_ERREUR = 'EN_ERREUR'
  }

  export function demarrerEnvoi(
    statut: StatutEnvoi | null
  ): Result<StatutEnvoi> {
    return transition(statut, [StatutEnvoi.A_ENVOYER], StatutEnvoi.EN_COURS)
  }

  export function annulerEnvoi(
    statut: StatutEnvoi | null
  ): Result<StatutEnvoi> {
    return transition(statut, [StatutEnvoi.EN_COURS], StatutEnvoi.ANNULEE)
  }

  export function relancerEnvoi(
    statut: StatutEnvoi | null
  ): Result<StatutEnvoi> {
    return transition(
      statut,
      [StatutEnvoi.ANNULEE, StatutEnvoi.EN_ERREUR],
      StatutEnvoi.EN_COURS
    )
  }

  export function estModifiable(statut: StatutEnvoi | null): boolean {
    return statut === null || statut === StatutEnvoi.A_ENVOYER
  }

  function transition(
    depuis: StatutEnvoi | null,
    autorises: StatutEnvoi[],
    vers: StatutEnvoi
  ): Result<StatutEnvoi> {
    if (depuis === null || !autorises.includes(depuis)) {
      return failure(
        new MauvaiseCommandeError(
          `Transition d'envoi impossible depuis le statut ${depuis ?? 'aucun'} vers ${vers}`
        )
      )
    }
    return success(vers)
  }
```

Mettre à jour le commentaire en tête de fichier qui cite `NotifierBeneficiairesPayload` :

```ts
// Le contenu d'une communication NOTIFICATION devient le titre et le corps de
// la notification push : mêmes limites que Firebase affiche sans troncature.
```

- [ ] **Step 4 : Créer `src/domain/communication-envoi.ts`** (statut par jeune ; les helpers de débit arrivent en Task 2)

```ts
export namespace CommunicationEnvoi {
  // EN_COURS = réservé par un lot (plusieurs workers) ; libéré si le lot meurt
  export enum Statut {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ERREUR = 'ERREUR',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE'
  }
}
```

- [ ] **Step 5 : Vérifier**

Run: `yarn test:local:unit -- --grep 'Communication'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/domain/communication.ts src/domain/communication-envoi.ts test/domain/communication.test.ts
git commit -m "feat(communications): statut d'envoi et transitions"
```

---

### Task 2 : Domaine — calcul du débit et créneau ouvré

**Files:**
- Modify: `src/domain/communication-envoi.ts`
- Test: `test/domain/communication-envoi.test.ts`

**Interfaces:**
- Produces:
  ```ts
  CommunicationEnvoi.Bornes = { debitMinParSeconde: number; debitMaxParSeconde: number }
  CommunicationEnvoi.calculerDebit(restantes: number, maintenant: DateTime, bornes: Bornes): number   // notifs/s
  CommunicationEnvoi.prochainCreneauOuvre(date: DateTime): DateTime                                    // 8h-17h Paris, lun-ven
  ```
- Règles : fenêtre = secondes entre `maintenant` (Paris) et 17h le même jour si `maintenant` est un jour ouvré entre 8h et 17h, sinon `9 × 3600`. `debit = clamp(restantes / fenetre, min, max)`. `prochainCreneauOuvre` : reprend la logique de `reporterDateEnJourOuvreLaJournee` de `src/application/jobs/notifier-beneficiaires.job.handler.db.ts:146-176` (≥ 17h → lendemain 8h ; < 8h → 8h ; samedi/dimanche → lundi 8h), en la corrigeant : un vendredi 17h30 doit donner **lundi** 8h (l'implémentation actuelle donne samedi puis lundi par deux `set` successifs, résultat identique — vérifié par test).

- [ ] **Step 1 : Écrire les tests**

`test/domain/communication-envoi.test.ts` :

```ts
import { DateTime } from 'luxon'
import { CommunicationEnvoi } from '../../src/domain/communication-envoi'
import { expect } from '../utils'

const bornes: CommunicationEnvoi.Bornes = {
  debitMinParSeconde: 1,
  debitMaxParSeconde: 10
}
const paris = (iso: string): DateTime =>
  DateTime.fromISO(iso, { zone: 'Europe/Paris' })

describe('CommunicationEnvoi', () => {
  describe('calculerDebit', () => {
    it('étale les restantes sur le temps qui reste avant 17h', () => {
      // 4h avant 17h = 14400 s, 28800 restantes → 2/s
      expect(
        CommunicationEnvoi.calculerDebit(28800, paris('2026-09-21T13:00'), bornes)
      ).to.equal(2)
    })

    it('plafonne au débit max', () => {
      expect(
        CommunicationEnvoi.calculerDebit(1_000_000, paris('2026-09-21T16:59'), bornes)
      ).to.equal(10)
    })

    it('ne descend pas sous le débit min', () => {
      expect(
        CommunicationEnvoi.calculerDebit(10, paris('2026-09-21T09:00'), bornes)
      ).to.equal(1)
    })

    it('hors fenêtre ouvrée, raisonne sur une journée entière de 9h', () => {
      // 32400 restantes / 32400 s → 1/s ; à 3/s sur 3h ce serait plafonné
      expect(
        CommunicationEnvoi.calculerDebit(64800, paris('2026-09-19T10:00'), bornes)
      ).to.equal(2)
      expect(
        CommunicationEnvoi.calculerDebit(64800, paris('2026-09-21T19:00'), bornes)
      ).to.equal(2)
    })
  })

  describe('prochainCreneauOuvre', () => {
    const cas: Array<[string, string, string]> = [
      ['en pleine journée ouvrée, inchangé', '2026-09-21T10:30', '2026-09-21T10:30'],
      ['avant 8h, reporté à 8h', '2026-09-21T06:15', '2026-09-21T08:00'],
      ['après 17h, reporté au lendemain 8h', '2026-09-21T17:00', '2026-09-22T08:00'],
      ['vendredi après 17h, reporté à lundi 8h', '2026-09-25T18:00', '2026-09-28T08:00'],
      ['samedi, reporté à lundi 8h', '2026-09-26T11:00', '2026-09-28T08:00'],
      ['dimanche, reporté à lundi 8h', '2026-09-27T11:00', '2026-09-28T08:00']
    ]
    for (const [libelle, entree, attendu] of cas) {
      it(libelle, () => {
        const resultat = CommunicationEnvoi.prochainCreneauOuvre(paris(entree))
        expect(resultat.toISO()).to.equal(paris(attendu).toISO())
      })
    }
  })
})
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:unit -- --grep 'CommunicationEnvoi'`
Expected: FAIL — `calculerDebit` n'existe pas.

- [ ] **Step 3 : Implémenter**

Compléter `src/domain/communication-envoi.ts` :

```ts
import { DateTime, WeekdayNumbers } from 'luxon'
import { TIME_ZONE_EUROPE_PARIS } from '../config/configuration'

const HEURE_DEBUT = 8
const HEURE_FIN = 17
const SECONDES_PAR_JOURNEE_OUVREE = (HEURE_FIN - HEURE_DEBUT) * 3600
const LUNDI: WeekdayNumbers = 1
const SAMEDI = 6

export namespace CommunicationEnvoi {
  // EN_COURS = réservé par un lot (plusieurs workers) ; libéré si le lot meurt
  export enum Statut {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ERREUR = 'ERREUR',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE'
  }

  export interface Bornes {
    debitMinParSeconde: number
    debitMaxParSeconde: number
  }

  export function calculerDebit(
    restantes: number,
    maintenant: DateTime,
    bornes: Bornes
  ): number {
    const fenetreSecondes = secondesRestantesDansLaJourneeOuvree(
      maintenant.setZone(TIME_ZONE_EUROPE_PARIS)
    )
    const debit = restantes / fenetreSecondes
    return Math.min(
      bornes.debitMaxParSeconde,
      Math.max(bornes.debitMinParSeconde, debit)
    )
  }

  export function prochainCreneauOuvre(date: DateTime): DateTime {
    let creneau = date.setZone(TIME_ZONE_EUROPE_PARIS)
    if (creneau.hour >= HEURE_FIN) {
      creneau = creneau.plus({ days: 1 })
    }
    if (creneau.weekday >= SAMEDI) {
      creneau = creneau.plus({ weeks: 1 }).set({ weekday: LUNDI })
    }
    if (creneau.hour < HEURE_DEBUT || !creneau.hasSame(date, 'day')) {
      creneau = creneau.set({
        hour: HEURE_DEBUT,
        minute: 0,
        second: 0,
        millisecond: 0
      })
    }
    return creneau
  }

  function secondesRestantesDansLaJourneeOuvree(maintenant: DateTime): number {
    const estOuvre =
      maintenant.weekday < SAMEDI &&
      maintenant.hour >= HEURE_DEBUT &&
      maintenant.hour < HEURE_FIN
    if (!estOuvre) return SECONDES_PAR_JOURNEE_OUVREE
    const finDeJournee = maintenant.set({
      hour: HEURE_FIN,
      minute: 0,
      second: 0,
      millisecond: 0
    })
    return Math.max(1, finDeJournee.diff(maintenant, 'seconds').seconds)
  }
}
```

Attention à `prochainCreneauOuvre` : `creneau.plus({ weeks: 1 }).set({ weekday: LUNDI })` sur un samedi donne le lundi de la semaine **suivante** (Luxon : `set({ weekday })` reste dans la semaine ISO courante, lun-dim). Vérifier avec les tests : samedi 26/09 → `plus 1 week` = samedi 03/10 → `weekday 1` = lundi 28/09. Si un test échoue, remplacer par `creneau.plus({ days: 8 - creneau.weekday })`.

- [ ] **Step 4 : Vérifier**

Run: `yarn test:local:unit -- --grep 'CommunicationEnvoi'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/domain/communication-envoi.ts test/domain/communication-envoi.test.ts
git commit -m "feat(communications): calcul du débit d'envoi et créneau ouvré"
```

---

### Task 3 : Migration et modèles Sequelize

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260921000000-communication-statut-envoi.js`
- Modify: `src/infrastructure/sequelize/models/communication.sql-model.ts`
- Create: `src/infrastructure/sequelize/models/communication-envoi.sql-model.ts`
- Modify: `src/infrastructure/sequelize/providers.ts` (enregistrement du modèle — chercher où `CommunicationSqlModel` est listé et ajouter le nouveau à côté)
- Modify (compilation) : tout ce qui référence `envoyeeLe` — `src/application/jobs/notifier-communications.job.handler.db.ts`, `src/application/queries/get-population-support.query.handler.db.ts`, `src/application/queries/query-models/population-support.query-model.ts`, `test/application/jobs/notifier-communications.job.handler.db.test.ts`, `test/application/queries/get-population-support.query.handler.db.test.ts` si elle existe. Objectif de cette tâche : **compiler**, pas encore implémenter — remplacer `envoyeeLe` par `statutEnvoi` / `envoiTermineLe` de façon minimale (le cron et la query sont réécrits en Task 7 et 9).

**Interfaces:**
- Produces :
  ```ts
  CommunicationSqlModel.statutEnvoi: Communication.StatutEnvoi | null
  CommunicationSqlModel.envoiTermineLe: Date | null
  CommunicationEnvoiSqlModel { idCommunication: number; idJeune: string; statut: CommunicationEnvoi.Statut; dateTraitement: Date | null }
  ```

- [ ] **Step 1 : Migration**

```js
'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
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
      await queryInterface.sequelize.query(
        `UPDATE communication
         SET statut_envoi = CASE WHEN envoyee_le IS NULL THEN 'A_ENVOYER' ELSE 'ENVOYEE' END,
             envoi_termine_le = envoyee_le
         WHERE type = 'NOTIFICATION'`,
        { transaction }
      )
      await queryInterface.removeColumn('communication', 'envoyee_le', {
        transaction
      })

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
        { name: 'communication_envoi_id_communication_statut_idx', transaction }
      )
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable('communication_envoi', { transaction })
      await queryInterface.addColumn(
        'communication',
        'envoyee_le',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE communication SET envoyee_le = envoi_termine_le`,
        { transaction }
      )
      await queryInterface.removeColumn('communication', 'envoi_termine_le', {
        transaction
      })
      await queryInterface.removeColumn('communication', 'statut_envoi', {
        transaction
      })
    })
  }
}
```

- [ ] **Step 2 : Modèle `communication`**

Dans `communication.sql-model.ts`, remplacer le bloc `envoyeeLe` par :

```ts
  @Column({ field: 'statut_envoi', type: DataType.STRING })
  statutEnvoi: Communication.StatutEnvoi | null

  @Column({ field: 'envoi_termine_le', type: DataType.DATE })
  envoiTermineLe: Date | null
```

- [ ] **Step 3 : Modèle `communication_envoi`**

`src/infrastructure/sequelize/models/communication-envoi.sql-model.ts` :

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

Enregistrer le modèle : `grep -n "CommunicationSqlModel" src/infrastructure/sequelize/providers.ts` et ajouter `CommunicationEnvoiSqlModel` dans la même liste (import + entrée).

- [ ] **Step 4 : Faire compiler les usages de `envoyeeLe`**

- `notifier-communications.job.handler.db.ts` : `envoyeeLe: null` → `statutEnvoi: Communication.StatutEnvoi.A_ENVOYER` dans le `where`, et `communication.update({ envoyeeLe: … })` → `communication.update({ statutEnvoi: Communication.StatutEnvoi.EN_COURS })`.
- `get-population-support.query.handler.db.ts` + query model : remplacer `envoyeeLe?: string` par `statutEnvoi?: Communication.StatutEnvoi` et `envoiTermineLe?: string`, mapping `co.statutEnvoi ?? undefined` / `co.envoiTermineLe ? DateTime…toISO() : undefined`.
- Tests correspondants : remplacer `envoyeeLe` par `statutEnvoi` dans les fixtures / assertions (les tests du cron seront réécrits en Task 7 ; ici seulement les faire compiler et passer au vert ou les marquer `.skip` **temporairement** avec un `// TODO: réécrits en Task 7`).

- [ ] **Step 5 : Vérifier**

Run: `yarn db:test && yarn migration` (ou la commande de migration de test : vérifier `package.json`), puis `yarn tsc --noEmit && yarn lint && yarn test:local:db -- --grep 'Communication'`
Expected: compile, lint OK, tests DB du périmètre au vert (ou skip explicites).

- [ ] **Step 6 : Commit**

```bash
git add src/infrastructure/sequelize test src/application/jobs/notifier-communications.job.handler.db.ts src/application/queries
git commit -m "feat(communications): statut_envoi, envoi_termine_le et table communication_envoi"
```

---

### Task 4 : `Notification.Repository.send` retourne le résultat d'envoi

**Files:**
- Modify: `src/domain/notification/notification.ts`
- Modify: `src/infrastructure/clients/firebase-client.ts:102-123`
- Modify: `src/infrastructure/repositories/notification-firebase.repository.db.ts:125-155`
- Test: `test/infrastructure/clients/firebase-client.test.ts` (s'il existe ; sinon `test/infrastructure/repositories/notification-firebase.repository.db.test.ts`)

**Interfaces:**
- Produces :
  ```ts
  Notification.ResultatEnvoi = 'ENVOYEE' | 'TOKEN_INVALIDE' | 'ERREUR'
  FirebaseClient.send(tokenMessage): Promise<Notification.ResultatEnvoi>
  Notification.Repository.send(message, idJeune?, pushNotification?): Promise<Notification.ResultatEnvoi>  // ENVOYEE si pushNotification=false
  ```
- Les appelants existants ignorent la valeur de retour : aucun changement chez eux. Seule différence de comportement : le repository **awaite** désormais Firebase (il ne le faisait pas), ce qui rend les erreurs visibles au moment de l'appel.

- [ ] **Step 1 : Tests du repository**

Dans `test/infrastructure/repositories/notification-firebase.repository.db.test.ts`, dans le `describe('send')`, ajouter :

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

(`message` : réutiliser le message push déjà construit dans ce fichier — `unMessagePush(...)` ou équivalent.)

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'NotificationFirebaseSqlRepository'` (adapter au nom du `describe`)
Expected: FAIL — `ResultatEnvoi` inexistant.

- [ ] **Step 3 : Domaine**

Dans `src/domain/notification/notification.ts`, dans le namespace, avant `interface Repository` :

```ts
  export enum ResultatEnvoi {
    ENVOYEE = 'ENVOYEE',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE',
    ERREUR = 'ERREUR'
  }
```

et `send(...): Promise<ResultatEnvoi>` dans l'interface.

- [ ] **Step 4 : Firebase client**

Remplacer `send` par :

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
        e.code === 'messaging/registration-token-not-registered'
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

(importer `Notification` depuis `../../domain/notification/notification` si absent.)

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

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:db -- --grep 'Notification'` et `yarn test:local:unit -- --grep 'Firebase'`
Expected: PASS. Si des stubs `firebaseClient.send.resolves()` sans valeur cassent des assertions, laisser : `undefined` n'est comparé nulle part ailleurs.

- [ ] **Step 7 : Commit**

```bash
git add src/domain/notification/notification.ts src/infrastructure/clients/firebase-client.ts src/infrastructure/repositories/notification-firebase.repository.db.ts test
git commit -m "feat(notification): send retourne le résultat d'envoi Firebase"
```

---

### Task 5 : Repository — figer, lire, marquer, compter les envois

**Files:**
- Modify: `src/domain/communication.ts` (interface `Repository`)
- Modify: `src/infrastructure/repositories/communication.repository.db.ts`
- Test: `test/infrastructure/repositories/communication.repository.db.test.ts`

**Interfaces:**
- Produces (dans `Communication.Repository`) :
  ```ts
  figerPopulationAEnvoyer(idCommunication: number, idPopulation: string): Promise<void>
  reserverProchainsEnvois(idCommunication: number, limite: number, maintenant: DateTime): Promise<Array<{ idJeune: string; token: string | null }>>
      // passe atomiquement `limite` lignes A_ENVOYER en EN_COURS (FOR UPDATE SKIP LOCKED) et les renvoie avec le token courant
  libererEnvoisBloques(idCommunication: number, reservesAvant: DateTime): Promise<number>
      // EN_COURS dont date_traitement < reservesAvant → A_ENVOYER ; renvoie le nombre libéré
  marquerEnvoi(idCommunication: number, idJeune: string, statut: CommunicationEnvoi.Statut, date: DateTime): Promise<void>
  compterEnvois(idCommunication: number): Promise<Record<CommunicationEnvoi.Statut, number>>
  ```

- [ ] **Step 1 : Tests**

Ajouter dans `communication.repository.db.test.ts` (le `beforeEach` existant crée déjà 3 conseillers et 4 jeunes ; `jeuneDuConseillerCite` et `jeuneTransfere` sont dans une population citant `cite@ft.fr` — vérifier les populations créées dans ce `beforeEach` et réutiliser celle qui couvre exactement ces deux jeunes ; ci-dessous elle s'appelle `PILOTE`) :

```ts
  describe('envois', () => {
    let idCommunication: number

    beforeEach(async () => {
      const communication = await CommunicationSqlModel.create({
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        dateDebut: maintenant.toJSDate(),
        dateFin: null,
        titre: 'Titre',
        contenu: 'Contenu',
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER
      })
      idCommunication = communication.id
      await JeuneSqlModel.update(
        { pushNotificationToken: null },
        { where: { id: 'jeuneTransfere' } }
      )
    })

    it('figerPopulationAEnvoyer insère les jeunes de la population ayant un token, sans doublon', async () => {
      // When
      await repo.figerPopulationAEnvoyer(idCommunication, 'PILOTE')
      await repo.figerPopulationAEnvoyer(idCommunication, 'PILOTE')

      // Then
      const envois = await CommunicationEnvoiSqlModel.findAll({
        where: { idCommunication },
        order: [['idJeune', 'ASC']]
      })
      expect(envois.map(e => e.idJeune)).to.deep.equal(['jeuneDuConseillerCite'])
      expect(envois[0].statut).to.equal(CommunicationEnvoi.Statut.A_ENVOYER)
      expect(envois[0].dateTraitement).to.equal(null)
    })

    it('reserverProchainsEnvois passe les A_ENVOYER en EN_COURS par id et renvoie le token courant', async () => {
      // Given
      await CommunicationEnvoiSqlModel.bulkCreate([
        { idCommunication, idJeune: 'jeuneMilo', statut: CommunicationEnvoi.Statut.A_ENVOYER },
        { idCommunication, idJeune: 'jeuneFtCej', statut: CommunicationEnvoi.Statut.ENVOYEE },
        { idCommunication, idJeune: 'jeuneDuConseillerCite', statut: CommunicationEnvoi.Statut.A_ENVOYER },
        { idCommunication, idJeune: 'jeuneTransfere', statut: CommunicationEnvoi.Statut.A_ENVOYER }
      ])

      // When
      const reserves = await repo.reserverProchainsEnvois(idCommunication, 2, maintenant)

      // Then
      expect(reserves).to.deep.equal([
        { idJeune: 'jeuneDuConseillerCite', token: 'token' },
        { idJeune: 'jeuneMilo', token: 'token' }
      ])
      const enCours = await CommunicationEnvoiSqlModel.findAll({
        where: { idCommunication, statut: CommunicationEnvoi.Statut.EN_COURS },
        order: [['idJeune', 'ASC']]
      })
      expect(enCours.map(e => e.idJeune)).to.deep.equal(['jeuneDuConseillerCite', 'jeuneMilo'])
      expect(enCours[0].dateTraitement).to.deep.equal(maintenant.toJSDate())
      const restant = await CommunicationEnvoiSqlModel.findOne({
        where: { idCommunication, idJeune: 'jeuneTransfere' }
      })
      expect(restant!.statut).to.equal(CommunicationEnvoi.Statut.A_ENVOYER)
    })

    it('reserverProchainsEnvois : deux réservations concurrentes ne se partagent aucun jeune', async () => {
      // Given
      await CommunicationEnvoiSqlModel.bulkCreate(
        ['jeuneMilo', 'jeuneFtCej', 'jeuneDuConseillerCite', 'jeuneTransfere'].map(idJeune => ({
          idCommunication, idJeune, statut: CommunicationEnvoi.Statut.A_ENVOYER
        }))
      )

      // When
      const [a, b] = await Promise.all([
        repo.reserverProchainsEnvois(idCommunication, 2, maintenant),
        repo.reserverProchainsEnvois(idCommunication, 2, maintenant)
      ])

      // Then
      const ids = [...a, ...b].map(e => e.idJeune)
      expect(ids).to.have.lengthOf(4)
      expect(new Set(ids).size).to.equal(4)
    })

    it('libererEnvoisBloques repasse A_ENVOYER les EN_COURS réservés avant la date donnée', async () => {
      // Given
      const ilYaDixMinutes = maintenant.minus({ minutes: 10 }).toJSDate()
      await CommunicationEnvoiSqlModel.bulkCreate([
        { idCommunication, idJeune: 'jeuneMilo', statut: CommunicationEnvoi.Statut.EN_COURS, dateTraitement: ilYaDixMinutes },
        { idCommunication, idJeune: 'jeuneFtCej', statut: CommunicationEnvoi.Statut.EN_COURS, dateTraitement: maintenant.toJSDate() },
        { idCommunication, idJeune: 'jeuneDuConseillerCite', statut: CommunicationEnvoi.Statut.ENVOYEE, dateTraitement: ilYaDixMinutes }
      ])

      // When
      const nbLiberes = await repo.libererEnvoisBloques(
        idCommunication,
        maintenant.minus({ minutes: 5 })
      )

      // Then
      expect(nbLiberes).to.equal(1)
      const milo = await CommunicationEnvoiSqlModel.findOne({ where: { idCommunication, idJeune: 'jeuneMilo' } })
      expect(milo!.statut).to.equal(CommunicationEnvoi.Statut.A_ENVOYER)
      const ftCej = await CommunicationEnvoiSqlModel.findOne({ where: { idCommunication, idJeune: 'jeuneFtCej' } })
      expect(ftCej!.statut).to.equal(CommunicationEnvoi.Statut.EN_COURS)
    })

    it('marquerEnvoi pose le statut et la date', async () => {
      // Given
      await CommunicationEnvoiSqlModel.create({
        idCommunication,
        idJeune: 'jeuneMilo',
        statut: CommunicationEnvoi.Statut.A_ENVOYER
      })

      // When
      await repo.marquerEnvoi(
        idCommunication,
        'jeuneMilo',
        CommunicationEnvoi.Statut.TOKEN_INVALIDE,
        maintenant
      )

      // Then
      const envoi = await CommunicationEnvoiSqlModel.findOne({
        where: { idCommunication, idJeune: 'jeuneMilo' }
      })
      expect(envoi!.statut).to.equal(CommunicationEnvoi.Statut.TOKEN_INVALIDE)
      expect(envoi!.dateTraitement).to.deep.equal(maintenant.toJSDate())
    })

    it('compterEnvois renvoie un compteur par statut, à zéro quand absent', async () => {
      // Given
      await CommunicationEnvoiSqlModel.bulkCreate([
        { idCommunication, idJeune: 'jeuneMilo', statut: CommunicationEnvoi.Statut.ENVOYEE },
        { idCommunication, idJeune: 'jeuneFtCej', statut: CommunicationEnvoi.Statut.ENVOYEE },
        { idCommunication, idJeune: 'jeuneDuConseillerCite', statut: CommunicationEnvoi.Statut.A_ENVOYER }
      ])

      // When
      const compteurs = await repo.compterEnvois(idCommunication)

      // Then
      expect(compteurs).to.deep.equal({
        A_ENVOYER: 1,
        EN_COURS: 0,
        ENVOYEE: 2,
        ERREUR: 0,
        TOKEN_INVALIDE: 0
      })
    })
  })
```

Imports à ajouter : `Notification`, `CommunicationEnvoi`, `CommunicationEnvoiSqlModel`.

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'CommunicationSqlRepository'`
Expected: FAIL — méthodes absentes.

- [ ] **Step 3 : Interface domaine**

Dans `Communication.Repository` (`src/domain/communication.ts`), ajouter les 5 signatures ci-dessus (importer `CommunicationEnvoi` depuis `./communication-envoi`).

- [ ] **Step 4 : Implémentation**

Dans `CommunicationSqlRepository` :

```ts
  async figerPopulationAEnvoyer(
    idCommunication: number,
    idPopulation: string
  ): Promise<void> {
    await this.sequelize.query(
      `
        INSERT INTO communication_envoi (id_communication, id_jeune, statut)
        SELECT :idCommunication, j.id, :statut
        FROM jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
        WHERE j.push_notification_token IS NOT NULL
          AND ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          idCommunication,
          idPopulation,
          statut: CommunicationEnvoi.Statut.A_ENVOYER
        },
        type: QueryTypes.INSERT
      }
    )
  }

  async reserverProchainsEnvois(
    idCommunication: number,
    limite: number,
    maintenant: DateTime
  ): Promise<Array<{ idJeune: string; token: string | null }>> {
    const [lignes] = await this.sequelize.query<{
      idJeune: string
      token: string | null
    }>(
      `
        WITH reserves AS (
          SELECT id_communication, id_jeune
          FROM communication_envoi
          WHERE id_communication = :idCommunication
            AND statut = :aEnvoyer
          ORDER BY id_jeune ASC
          LIMIT :limite
          FOR UPDATE SKIP LOCKED
        )
        UPDATE communication_envoi ce
        SET statut = :enCours, date_traitement = :maintenant
        FROM reserves r
        JOIN jeune j ON j.id = r.id_jeune
        WHERE ce.id_communication = r.id_communication
          AND ce.id_jeune = r.id_jeune
        RETURNING ce.id_jeune AS "idJeune", j.push_notification_token AS token
      `,
      {
        replacements: {
          idCommunication,
          limite,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER,
          enCours: CommunicationEnvoi.Statut.EN_COURS,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.UPDATE
      }
    )
    return [...lignes].sort((a, b) => a.idJeune.localeCompare(b.idJeune))
  }

  async libererEnvoisBloques(
    idCommunication: number,
    reservesAvant: DateTime
  ): Promise<number> {
    const [, nbLiberes] = await this.sequelize.query(
      `
        UPDATE communication_envoi
        SET statut = :aEnvoyer, date_traitement = NULL
        WHERE id_communication = :idCommunication
          AND statut = :enCours
          AND date_traitement < :reservesAvant
      `,
      {
        replacements: {
          idCommunication,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER,
          enCours: CommunicationEnvoi.Statut.EN_COURS,
          reservesAvant: reservesAvant.toJSDate()
        },
        type: QueryTypes.UPDATE
      }
    )
    return nbLiberes
  }

  async marquerEnvoi(
    idCommunication: number,
    idJeune: string,
    statut: CommunicationEnvoi.Statut,
    date: DateTime
  ): Promise<void> {
    await CommunicationEnvoiSqlModel.update(
      { statut, dateTraitement: date.toJSDate() },
      { where: { idCommunication, idJeune } }
    )
  }

  async compterEnvois(
    idCommunication: number
  ): Promise<Record<CommunicationEnvoi.Statut, number>> {
    const lignes = await this.sequelize.query<{
      statut: CommunicationEnvoi.Statut
      nb: string
    }>(
      `
        SELECT statut, COUNT(*) AS nb
        FROM communication_envoi
        WHERE id_communication = :idCommunication
        GROUP BY statut
      `,
      { replacements: { idCommunication }, type: QueryTypes.SELECT }
    )
    const compteurs: Record<CommunicationEnvoi.Statut, number> = {
      A_ENVOYER: 0,
      EN_COURS: 0,
      ENVOYEE: 0,
      ERREUR: 0,
      TOKEN_INVALIDE: 0
    }
    for (const ligne of lignes) compteurs[ligne.statut] = Number(ligne.nb)
    return compteurs
  }
```

Imports : `sqlJoinConseillerDeReference` (déjà dans `sql-helpers`), `CommunicationEnvoi`, `CommunicationEnvoiSqlModel`.

Notes sur `reserverProchainsEnvois` :
- `FOR UPDATE SKIP LOCKED` dans la CTE : une transaction concurrente saute les lignes déjà verrouillées au lieu d'attendre → deux workers ne se partagent jamais un jeune. Le `SELECT` et l'`UPDATE` sont dans la même instruction, donc la même transaction implicite.
- Le retour de `sequelize.query` en `QueryTypes.UPDATE` est `[rows, count]` ; on trie côté Node car `RETURNING` ne garantit pas l'ordre.
- Le test « deux réservations concurrentes » passe avec un pool Sequelize ≥ 2 connexions (défaut) ; s'il est à 1 en test, les deux appels se sérialisent et le test reste vert (il vérifie l'absence de partage, pas la simultanéité).

- [ ] **Step 5 : Vérifier**

Run: `yarn test:local:db -- --grep 'CommunicationSqlRepository'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/domain/communication.ts src/infrastructure/repositories/communication.repository.db.ts test/infrastructure/repositories/communication.repository.db.test.ts
git commit -m "feat(communications): repository des envois par jeune (réservation multi-workers)"
```

---

### Task 6 : Job `ENVOYER_LOT_COMMUNICATION`

**Files:**
- Modify: `src/config/configuration.ts` (bloc `jobs`)
- Modify: `src/domain/planificateur.ts` (`JobType`, contenu du job)
- Modify: `src/domain/suivi-job.ts` (`estJobSuivi`, `estNotifiable`)
- Create: `src/application/jobs/envoyer-lot-communication.job.handler.db.ts`
- Modify: `src/app.module.ts` (import + provider, à côté de `NotifierCommunicationsJobHandler`)
- Test: `test/application/jobs/envoyer-lot-communication.job.handler.db.test.ts`

**Interfaces:**
- Consumes : Task 1, 2, 4, 5 (`reserverProchainsEnvois`, `libererEnvoisBloques`, `marquerEnvoi`, `compterEnvois`).
- Produces :
  ```ts
  Planificateur.JobType.ENVOYER_LOT_COMMUNICATION = 'ENVOYER_LOT_COMMUNICATION'
  Planificateur.JobEnvoyerLotCommunication { idCommunication: number; numeroLot: number; echecsConsecutifs: number }
  Planificateur.jobIdLotCommunication(idCommunication: number, numeroLot: number): string  // `ENVOYER_LOT_COMMUNICATION:${id}:${lot}`
  config jobs.envoiCommunication { debitMinParSeconde: string; debitMaxParSeconde: string; dureeLotSecondes: string }
  ```
  Env : `JOB_ENVOI_COMMUNICATION_DEBIT_MIN` (défaut `'1'`), `JOB_ENVOI_COMMUNICATION_DEBIT_MAX` (`'10'`), `JOB_ENVOI_COMMUNICATION_DUREE_LOT_SECONDES` (`'60'`).

- [ ] **Step 1 : Config, types, suivi**

`configuration.ts`, dans `jobs:` :

```ts
      envoiCommunication: {
        debitMinParSeconde:
          process.env.JOB_ENVOI_COMMUNICATION_DEBIT_MIN ?? '1',
        debitMaxParSeconde:
          process.env.JOB_ENVOI_COMMUNICATION_DEBIT_MAX ?? '10',
        dureeLotSecondes:
          process.env.JOB_ENVOI_COMMUNICATION_DUREE_LOT_SECONDES ?? '60'
      },
```

`planificateur.ts` : ajouter `ENVOYER_LOT_COMMUNICATION = 'ENVOYER_LOT_COMMUNICATION'` dans l'enum (après `NOTIFIER_COMMUNICATIONS`), et à côté de `JobNotifierBeneficiaires` :

```ts
  export interface JobEnvoyerLotCommunication {
    idCommunication: number
    numeroLot: number
    echecsConsecutifs: number
  }

  export function jobIdLotCommunication(
    idCommunication: number,
    numeroLot: number
  ): string {
    return `${JobType.ENVOYER_LOT_COMMUNICATION}:${idCommunication}:${numeroLot}`
  }
```

`suivi-job.ts` : ajouter `Planificateur.JobType.ENVOYER_LOT_COMMUNICATION` aux deux listes d'exclusion (`estJobSuivi` et `estNotifiable`).

- [ ] **Step 2 : Tests du job**

`test/application/jobs/envoyer-lot-communication.job.handler.db.test.ts` :

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { SinonSandbox } from 'sinon'
import { EnvoyerLotCommunicationJobHandler } from '../../../src/application/jobs/envoyer-lot-communication.job.handler.db'
import { Communication } from '../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../src/domain/communication-envoi'
import { Notification } from '../../../src/domain/notification/notification'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

// Lundi 10h à Paris : en pleine fenêtre ouvrée
const maintenant = DateTime.fromISO('2026-09-21T10:00:00', {
  zone: 'Europe/Paris'
})

describe('EnvoyerLotCommunicationJobHandler', () => {
  let handler: EnvoyerLotCommunicationJobHandler
  let sandbox: SinonSandbox
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let communicationRepository: StubbedType<Communication.Repository>
  let notificationRepository: StubbedType<Notification.Repository>
  let idCommunication: number

  before(async () => {
    await getDatabase().cleanPG()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    await PopulationSqlModel.create({ id: 'PHASE_C', description: null })
    const communication = await CommunicationSqlModel.create({
      idPopulation: 'PHASE_C',
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      dateDebut: maintenant.toJSDate(),
      dateFin: null,
      titre: 'Titre',
      contenu: 'Contenu',
      statutEnvoi: Communication.StatutEnvoi.EN_COURS
    })
    idCommunication = communication.id

    sandbox = createSandbox()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    communicationRepository = stubInterface(sandbox)
    notificationRepository = stubInterface(sandbox)
    notificationRepository.send.resolves(Notification.ResultatEnvoi.ENVOYEE)
    const configService = stubClass(ConfigService)
    configService.get.withArgs('jobs').returns({
      envoiCommunication: {
        debitMinParSeconde: '100',
        debitMaxParSeconde: '1000',
        dureeLotSecondes: '1'
      }
    })

    handler = new EnvoyerLotCommunicationJobHandler(
      suiviJobService,
      dateService,
      configService,
      planificateurRepository,
      communicationRepository,
      notificationRepository
    )
  })

  afterEach(() => {
    sandbox.reset()
  })

  function unJob(
    surcharge: Partial<Planificateur.JobEnvoyerLotCommunication> = {}
  ): Planificateur.Job<Planificateur.JobEnvoyerLotCommunication> {
    return {
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
      contenu: { idCommunication, numeroLot: 1, echecsConsecutifs: 0, ...surcharge }
    }
  }

  it('envoie le lot, marque chaque jeune selon le résultat, planifie le lot suivant', async () => {
    // Given
    communicationRepository.compterEnvois.resolves({
      A_ENVOYER: 3, EN_COURS: 0, ENVOYEE: 0, ERREUR: 0, TOKEN_INVALIDE: 0
    })
    communicationRepository.reserverProchainsEnvois.resolves([
      { idJeune: 'a', token: 'tok-a' },
      { idJeune: 'b', token: null },
      { idJeune: 'c', token: 'tok-c' }
    ])
    notificationRepository.send
      .onFirstCall().resolves(Notification.ResultatEnvoi.ENVOYEE)
      .onSecondCall().resolves(Notification.ResultatEnvoi.ERREUR)

    // When
    const suivi = await handler.handle(unJob())

    // Then
    expect(notificationRepository.send).to.have.been.calledTwice()
    expect(notificationRepository.send.firstCall.args).to.deep.equal([
      {
        token: 'tok-a',
        notification: { title: 'Titre', body: 'Contenu' },
        data: { type: Notification.Type.MIGRATION_PARCOURS_EMPLOI }
      },
      'a',
      true
    ])
    expect(communicationRepository.marquerEnvoi).to.have.been.calledWith(
      idCommunication, 'a', CommunicationEnvoi.Statut.ENVOYEE, maintenant
    )
    expect(communicationRepository.marquerEnvoi).to.have.been.calledWith(
      idCommunication, 'b', CommunicationEnvoi.Statut.TOKEN_INVALIDE, maintenant
    )
    expect(communicationRepository.marquerEnvoi).to.have.been.calledWith(
      idCommunication, 'c', CommunicationEnvoi.Statut.ERREUR, maintenant
    )
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWithExactly(
      {
        dateExecution: maintenant.plus({ seconds: 1 }).toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: { idCommunication, numeroLot: 2, echecsConsecutifs: 0 }
      },
      `ENVOYER_LOT_COMMUNICATION:${idCommunication}:2`
    )
    expect(suivi.succes).to.equal(true)
    // tailleLot = debitMin (100/s, 3 restantes sur 7h) × 1 s ; le stub renvoie 3 lignes quelle que soit la limite
    expect(suivi.resultat).to.deep.include({ tailleLot: 100, envoyees: 1, erreurs: 1, tokensInvalides: 1 })
  })

  it('libère les réservations orphelines de plus de 5 minutes avant de compter', async () => {
    // Given
    communicationRepository.compterEnvois.resolves({
      A_ENVOYER: 1, EN_COURS: 0, ENVOYEE: 0, ERREUR: 0, TOKEN_INVALIDE: 0
    })
    communicationRepository.reserverProchainsEnvois.resolves([])

    // When
    await handler.handle(unJob())

    // Then
    expect(communicationRepository.libererEnvoisBloques).to.have.been.calledOnceWithExactly(
      idCommunication,
      maintenant.minus({ minutes: 5 })
    )
    expect(communicationRepository.libererEnvoisBloques).to.have.been.calledBefore(
      communicationRepository.compterEnvois
    )
    expect(communicationRepository.reserverProchainsEnvois).to.have.been.calledOnceWithExactly(
      idCommunication, 100, maintenant
    )
  })

  it("ne termine pas tant qu'un autre lot a des réservations EN_COURS, replanifie seulement", async () => {
    // Given
    communicationRepository.compterEnvois.resolves({
      A_ENVOYER: 0, EN_COURS: 2, ENVOYEE: 5, ERREUR: 0, TOKEN_INVALIDE: 0
    })

    // When
    await handler.handle(unJob())

    // Then
    const communication = await CommunicationSqlModel.findByPk(idCommunication)
    expect(communication!.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_COURS)
    expect(communicationRepository.reserverProchainsEnvois).not.to.have.been.called()
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
  })

  it('termine la communication quand il ne reste rien à envoyer', async () => {
    // Given
    communicationRepository.compterEnvois.resolves({
      A_ENVOYER: 0, EN_COURS: 0, ENVOYEE: 5, ERREUR: 0, TOKEN_INVALIDE: 0
    })

    // When
    await handler.handle(unJob())

    // Then
    const communication = await CommunicationSqlModel.findByPk(idCommunication)
    expect(communication!.statutEnvoi).to.equal(Communication.StatutEnvoi.ENVOYEE)
    expect(communication!.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(notificationRepository.send).not.to.have.been.called()
  })

  it("ne fait rien si la communication n'est plus EN_COURS", async () => {
    // Given
    await CommunicationSqlModel.update(
      { statutEnvoi: Communication.StatutEnvoi.ANNULEE },
      { where: { id: idCommunication } }
    )

    // When
    const suivi = await handler.handle(unJob())

    // Then
    expect(communicationRepository.compterEnvois).not.to.have.been.called()
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suivi.resultat).to.deep.include({ ignore: true })
  })

  it('reporte le lot suivant au prochain créneau ouvré', async () => {
    // Given
    const vendredi17h = DateTime.fromISO('2026-09-25T17:00:00', { zone: 'Europe/Paris' })
    dateService.now.returns(vendredi17h)
    communicationRepository.compterEnvois.resolves({
      A_ENVOYER: 1, EN_COURS: 0, ENVOYEE: 0, ERREUR: 0, TOKEN_INVALIDE: 0
    })
    communicationRepository.reserverProchainsEnvois.resolves([{ idJeune: 'a', token: 'tok' }])

    // When
    await handler.handle(unJob())

    // Then
    const lundi8h = DateTime.fromISO('2026-09-28T08:00:00', { zone: 'Europe/Paris' })
    expect(planificateurRepository.ajouterJob.firstCall.args[0].dateExecution).to.deep.equal(
      lundi8h.toJSDate()
    )
  })

  it('en cas d’exception, replanifie dans une minute en comptant l’échec', async () => {
    // Given
    communicationRepository.compterEnvois.rejects(new Error('db down'))

    // When
    const suivi = await handler.handle(unJob({ echecsConsecutifs: 1 }))

    // Then
    expect(suivi.succes).to.equal(false)
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWithExactly(
      {
        dateExecution: maintenant.plus({ minutes: 1 }).toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: { idCommunication, numeroLot: 2, echecsConsecutifs: 2 }
      },
      `ENVOYER_LOT_COMMUNICATION:${idCommunication}:2`
    )
  })

  it('au troisième échec consécutif, passe la communication EN_ERREUR sans replanifier', async () => {
    // Given
    communicationRepository.compterEnvois.rejects(new Error('db down'))

    // When
    const suivi = await handler.handle(unJob({ echecsConsecutifs: 2 }))

    // Then
    expect(suivi.succes).to.equal(false)
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    const communication = await CommunicationSqlModel.findByPk(idCommunication)
    expect(communication!.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_ERREUR)
  })
})
```

- [ ] **Step 3 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'EnvoyerLotCommunicationJobHandler'`
Expected: FAIL — module introuvable.

- [ ] **Step 4 : Implémenter le handler**

`src/application/jobs/envoyer-lot-communication.job.handler.db.ts` :

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
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { DateService } from '../../utils/date-service'

const ECHECS_CONSECUTIFS_MAX = 3
const DELAI_AVANT_LOT_SUIVANT = { seconds: 1 }
const DELAI_APRES_ECHEC = { minutes: 1 }
// Un lot dure ~1 min : une réservation plus vieille que ça appartient à un worker mort
const AGE_RESERVATION_ORPHELINE = { minutes: 5 }

interface Resultat {
  idCommunication: number
  numeroLot: number
  ignore?: boolean
  termine?: boolean
  reservationsLiberees?: number
  restantes?: number
  enCoursAilleurs?: number
  debitParSeconde?: number
  tailleLot?: number
  envoyees?: number
  erreurs?: number
  tokensInvalides?: number
  echecsConsecutifs?: number
}

const STATUT_PAR_RESULTAT: Record<
  Notification.ResultatEnvoi,
  CommunicationEnvoi.Statut
> = {
  ENVOYEE: CommunicationEnvoi.Statut.ENVOYEE,
  TOKEN_INVALIDE: CommunicationEnvoi.Statut.TOKEN_INVALIDE,
  ERREUR: CommunicationEnvoi.Statut.ERREUR
}

@Injectable()
@ProcessJobType(Planificateur.JobType.ENVOYER_LOT_COMMUNICATION)
export class EnvoyerLotCommunicationJobHandler extends JobHandler<Planificateur.JobEnvoyerLotCommunication> {
  private readonly bornes: CommunicationEnvoi.Bornes
  private readonly dureeLotSecondes: number

  constructor(
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    configService: ConfigService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository
  ) {
    super(Planificateur.JobType.ENVOYER_LOT_COMMUNICATION, suiviJobService)
    const config = configService.get('jobs').envoiCommunication
    this.bornes = {
      debitMinParSeconde: Number(config.debitMinParSeconde),
      debitMaxParSeconde: Number(config.debitMaxParSeconde)
    }
    this.dureeLotSecondes = Number(config.dureeLotSecondes)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobEnvoyerLotCommunication>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { idCommunication, numeroLot, echecsConsecutifs } = job.contenu!
    const resultat: Resultat = { idCommunication, numeroLot }
    let succes = true

    try {
      const communication = await CommunicationSqlModel.findByPk(idCommunication)
      if (
        !communication ||
        communication.statutEnvoi !== Communication.StatutEnvoi.EN_COURS
      ) {
        resultat.ignore = true
        return this.suivi(maintenant, succes, resultat)
      }

      resultat.reservationsLiberees =
        await this.communicationRepository.libererEnvoisBloques(
          idCommunication,
          maintenant.minus(AGE_RESERVATION_ORPHELINE)
        )
      const compteurs =
        await this.communicationRepository.compterEnvois(idCommunication)
      resultat.restantes = compteurs.A_ENVOYER
      resultat.enCoursAilleurs = compteurs.EN_COURS
      if (compteurs.A_ENVOYER === 0 && compteurs.EN_COURS === 0) {
        await communication.update({
          statutEnvoi: Communication.StatutEnvoi.ENVOYEE,
          envoiTermineLe: maintenant.toJSDate()
        })
        resultat.termine = true
        return this.suivi(maintenant, succes, resultat)
      }

      if (compteurs.A_ENVOYER > 0) {
        const bilan = await this.envoyerUnLot(
          communication,
          compteurs.A_ENVOYER,
          maintenant,
          resultat
        )
        Object.assign(resultat, bilan)
      }

      await this.planifierLotSuivant(
        idCommunication,
        numeroLot + 1,
        0,
        CommunicationEnvoi.prochainCreneauOuvre(
          maintenant.plus(DELAI_AVANT_LOT_SUIVANT)
        )
      )
    } catch (e) {
      this.logger.error(e)
      succes = false
      const echecs = echecsConsecutifs + 1
      resultat.echecsConsecutifs = echecs
      if (echecs >= ECHECS_CONSECUTIFS_MAX) {
        await CommunicationSqlModel.update(
          { statutEnvoi: Communication.StatutEnvoi.EN_ERREUR },
          { where: { id: idCommunication } }
        )
      } else {
        await this.planifierLotSuivant(
          idCommunication,
          numeroLot + 1,
          echecs,
          maintenant.plus(DELAI_APRES_ECHEC)
        )
      }
    }

    return this.suivi(maintenant, succes, resultat)
  }

  private async envoyerUnLot(
    communication: CommunicationSqlModel,
    restantes: number,
    maintenant: DateTime,
    resultat: Resultat
  ): Promise<Pick<Resultat, 'envoyees' | 'erreurs' | 'tokensInvalides'>> {
    const debit = CommunicationEnvoi.calculerDebit(
      restantes,
      maintenant,
      this.bornes
    )
    const tailleLot = Math.ceil(debit * this.dureeLotSecondes)
    resultat.debitParSeconde = debit
    resultat.tailleLot = tailleLot

    const envois = await this.communicationRepository.reserverProchainsEnvois(
      communication.id,
      tailleLot,
      maintenant
    )
    return this.envoyerLeLot(communication, envois, debit, maintenant)
  }

  private async envoyerLeLot(
    communication: CommunicationSqlModel,
    envois: Array<{ idJeune: string; token: string | null }>,
    debitParSeconde: number,
    maintenant: DateTime
  ): Promise<Pick<Resultat, 'envoyees' | 'erreurs' | 'tokensInvalides'>> {
    const bilan = { envoyees: 0, erreurs: 0, tokensInvalides: 0 }
    const pauseMs = Math.round(1000 / debitParSeconde)

    for (const envoi of envois) {
      let statut = CommunicationEnvoi.Statut.TOKEN_INVALIDE
      if (envoi.token) {
        const resultatEnvoi = await this.notificationRepository.send(
          {
            token: envoi.token,
            notification: {
              title: communication.titre,
              body: communication.contenu
            },
            data: { type: communication.typeNotification! }
          },
          envoi.idJeune,
          communication.push ?? true
        )
        statut = STATUT_PAR_RESULTAT[resultatEnvoi]
        await new Promise(resolve => setTimeout(resolve, pauseMs))
      }
      await this.communicationRepository.marquerEnvoi(
        communication.id,
        envoi.idJeune,
        statut,
        maintenant
      )
      if (statut === CommunicationEnvoi.Statut.ENVOYEE) bilan.envoyees++
      else if (statut === CommunicationEnvoi.Statut.ERREUR) bilan.erreurs++
      else bilan.tokensInvalides++
    }
    return bilan
  }

  private async planifierLotSuivant(
    idCommunication: number,
    numeroLot: number,
    echecsConsecutifs: number,
    dateExecution: DateTime
  ): Promise<void> {
    await this.planificateurRepository.ajouterJob(
      {
        dateExecution: dateExecution.toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: { idCommunication, numeroLot, echecsConsecutifs }
      },
      Planificateur.jobIdLotCommunication(idCommunication, numeroLot)
    )
  }

  private suivi(
    maintenant: DateTime,
    succes: boolean,
    resultat: Resultat
  ): SuiviJob {
    return {
      jobType: this.jobType,
      nbErreurs: resultat.erreurs ?? 0,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat
    }
  }
}
```

Si une exception survient **pendant** `envoyerLeLot` (après réservation), les lignes réservées restent `EN_COURS` avec `date_traitement = maintenant` : un lot ultérieur les libérera après 5 min. C'est voulu — pas de `try/finally` qui les relâcherait immédiatement, sinon un lot rejoué (stalled) sur un autre worker pourrait les reprendre pendant que celui-ci envoie encore.

Note : dans le test « reporte le lot suivant », `maintenant.plus(1 s)` à 17:00:01 → `prochainCreneauOuvre` → lundi 8h ; le test « envoie le lot » attend `maintenant + 1 s` à 10h (dans la fenêtre → inchangé). Le test « exception » attend `maintenant + 1 min` **sans** report ouvré : c'est voulu (un échec technique ne dépend pas des heures ouvrées ; le lot suivant, lui, reportera s'il faut).

Enregistrer dans `app.module.ts` : importer `EnvoyerLotCommunicationJobHandler` et l'ajouter dans la liste des providers à côté de `NotifierCommunicationsJobHandler` (ligne ~1020).

- [ ] **Step 5 : Vérifier**

Run: `yarn test:local:db -- --grep 'EnvoyerLotCommunicationJobHandler'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/config/configuration.ts src/domain/planificateur.ts src/domain/suivi-job.ts src/application/jobs/envoyer-lot-communication.job.handler.db.ts src/app.module.ts test/application/jobs/envoyer-lot-communication.job.handler.db.test.ts
git commit -m "feat(communications): job ENVOYER_LOT_COMMUNICATION"
```

---

### Task 7 : Réécrire le cron `NOTIFIER_COMMUNICATIONS`

**Files:**
- Modify: `src/application/jobs/notifier-communications.job.handler.db.ts` (réécriture complète)
- Modify: `src/domain/planificateur.ts:282-286` (description du cron)
- Test: `test/application/jobs/notifier-communications.job.handler.db.test.ts` (réécriture complète)

**Interfaces:**
- Consumes : `Communication.demarrerEnvoi`, `Communication.Repository.figerPopulationAEnvoyer`, `Planificateur.jobIdLotCommunication`.

- [ ] **Step 1 : Réécrire les tests**

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { NotifierCommunicationsJobHandler } from '../../../src/application/jobs/notifier-communications.job.handler.db'
import { Communication } from '../../../src/domain/communication'
import { Notification } from '../../../src/domain/notification/notification'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

const maintenant = uneDatetime()
const hier = maintenant.minus({ days: 1 }).toJSDate()
const avantHier = maintenant.minus({ days: 2 }).toJSDate()
const demain = maintenant.plus({ days: 1 }).toJSDate()

describe('NotifierCommunicationsJobHandler', () => {
  let handler: NotifierCommunicationsJobHandler
  let sandbox: SinonSandbox
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let communicationRepository: StubbedType<Communication.Repository>

  before(async () => {
    await getDatabase().cleanPG()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    await PopulationSqlModel.create({ id: 'PHASE_C', description: null })
    sandbox = createSandbox()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    communicationRepository = stubInterface(sandbox)
    handler = new NotifierCommunicationsJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository,
      communicationRepository
    )
  })

  afterEach(() => {
    sandbox.reset()
  })

  function uneCommunicationNotification(
    surcharge: Partial<{
      dateDebut: Date
      statutEnvoi: Communication.StatutEnvoi | null
      type: Communication.Type
    }> = {}
  ): Promise<CommunicationSqlModel> {
    return CommunicationSqlModel.create({
      idPopulation: 'PHASE_C',
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

  it('fige la population, passe la communication EN_COURS et enfile le premier lot', async () => {
    // Given
    const communication = await uneCommunicationNotification()

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      communicationRepository.figerPopulationAEnvoyer
    ).to.have.been.calledOnceWithExactly(communication.id, 'PHASE_C')
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWithExactly(
      {
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: { idCommunication: communication.id, numeroLot: 1, echecsConsecutifs: 0 }
      },
      `ENVOYER_LOT_COMMUNICATION:${communication.id}:1`
    )
    const relue = await CommunicationSqlModel.findByPk(communication.id)
    expect(relue!.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_COURS)
    expect(suivi.resultat).to.deep.equal({
      idCommunicationDemarree: communication.id,
      bloqueParUnEnvoiEnCours: false
    })
  })

  it('démarre la plus ancienne quand plusieurs sont dues, les autres attendent', async () => {
    // Given
    await uneCommunicationNotification({ dateDebut: hier })
    const plusAncienne = await uneCommunicationNotification({ dateDebut: avantHier })

    // When
    await handler.handle()

    // Then
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
    expect(planificateurRepository.ajouterJob.firstCall.args[0].contenu.idCommunication).to.equal(plusAncienne.id)
  })

  it("ne démarre rien si une communication est déjà EN_COURS", async () => {
    // Given
    await uneCommunicationNotification({ statutEnvoi: Communication.StatutEnvoi.EN_COURS })
    await uneCommunicationNotification()

    // When
    const suivi = await handler.handle()

    // Then
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suivi.resultat).to.deep.equal({
      idCommunicationDemarree: undefined,
      bloqueParUnEnvoiEnCours: true
    })
  })

  it('ignore les communications futures, IN_APP, ou déjà traitées', async () => {
    // Given
    await uneCommunicationNotification({ dateDebut: demain })
    await uneCommunicationNotification({ type: Communication.Type.IN_APP, statutEnvoi: null })
    await uneCommunicationNotification({ statutEnvoi: Communication.StatutEnvoi.ENVOYEE })
    await uneCommunicationNotification({ statutEnvoi: Communication.StatutEnvoi.ANNULEE })

    // When
    await handler.handle()

    // Then
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
  })
})
```

Pour la communication `IN_APP` de test : `Communication.creer` n'est pas appelé ici, le `create` Sequelize direct accepte `typeNotification`/`push` renseignés ; ne pas s'en soucier.

- [ ] **Step 2 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'NotifierCommunicationsJobHandler'`
Expected: FAIL — constructeur à 4 arguments, `figerPopulationAEnvoyer` non appelé.

- [ ] **Step 3 : Réécrire le handler**

```ts
import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Op } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { DateService } from '../../utils/date-service'

interface Resultat {
  idCommunicationDemarree?: number
  bloqueParUnEnvoiEnCours: boolean
}

@Injectable()
@ProcessJobType(Planificateur.JobType.NOTIFIER_COMMUNICATIONS)
export class NotifierCommunicationsJobHandler extends JobHandler<void> {
  constructor(
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository
  ) {
    super(Planificateur.JobType.NOTIFIER_COMMUNICATIONS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const resultat: Resultat = { bloqueParUnEnvoiEnCours: false }
    let succes = true

    try {
      const enCours = await CommunicationSqlModel.count({
        where: { statutEnvoi: Communication.StatutEnvoi.EN_COURS }
      })
      if (enCours > 0) {
        resultat.bloqueParUnEnvoiEnCours = true
        return this.suivi(maintenant, succes, resultat)
      }

      const communication = await CommunicationSqlModel.findOne({
        where: {
          type: Communication.Type.NOTIFICATION,
          statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
          dateDebut: { [Op.lte]: maintenant.toJSDate() }
        },
        order: [['dateDebut', 'ASC']]
      })
      if (!communication) {
        return this.suivi(maintenant, succes, resultat)
      }

      const transition = Communication.demarrerEnvoi(communication.statutEnvoi)
      if (isFailure(transition)) {
        throw new Error(transition.error.message)
      }

      await this.communicationRepository.figerPopulationAEnvoyer(
        communication.id,
        communication.idPopulation
      )
      await communication.update({ statutEnvoi: transition.data })
      await this.planificateurRepository.ajouterJob(
        {
          dateExecution: maintenant.toJSDate(),
          type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
          contenu: {
            idCommunication: communication.id,
            numeroLot: 1,
            echecsConsecutifs: 0
          }
        },
        Planificateur.jobIdLotCommunication(communication.id, 1)
      )
      resultat.idCommunicationDemarree = communication.id
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return this.suivi(maintenant, succes, resultat)
  }

  private suivi(
    maintenant: DateTime,
    succes: boolean,
    resultat: Resultat
  ): SuiviJob {
    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat
    }
  }
}
```

Description du cron dans `planificateur.ts` :

```ts
    description:
      'Jours ouvrés à 9h. Démarre l’envoi de la plus ancienne communication NOTIFICATION due (population figée, premier lot ENVOYER_LOT_COMMUNICATION), une seule à la fois.'
```

- [ ] **Step 4 : Vérifier**

Run: `yarn test:local:db -- --grep 'NotifierCommunicationsJobHandler'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/application/jobs/notifier-communications.job.handler.db.ts src/domain/planificateur.ts test/application/jobs/notifier-communications.job.handler.db.test.ts
git commit -m "feat(communications): le cron démarre un envoi par lots"
```

---

### Task 8 : Commands support — statut initial, garde-fous, annulation, relance

**Files:**
- Modify: `src/application/commands/support/creer-communication.command.handler.db.ts:73-86`
- Modify: `src/application/commands/support/modifier-communication.command.handler.db.ts:55-85`
- Modify: `src/application/commands/support/supprimer-communication.command.handler.db.ts`
- Create: `src/application/commands/support/annuler-envoi-communication.command.handler.db.ts`
- Create: `src/application/commands/support/relancer-envoi-communication.command.handler.db.ts`
- Modify: `src/app.module.ts` (2 providers, à côté de `ModifierCommunicationCommandHandler`)
- Test: `test/application/commands/support/{creer,modifier,supprimer}-communication.command.handler.db.test.ts` (ajouts), `test/application/commands/support/annuler-envoi-communication.command.handler.db.test.ts`, `test/application/commands/support/relancer-envoi-communication.command.handler.db.test.ts`

**Interfaces:**
- Produces :
  ```ts
  AnnulerEnvoiCommunicationCommand { id: number }  → Result<void>
  RelancerEnvoiCommunicationCommand { id: number } → Result<void>
  ```

- [ ] **Step 1 : Tests créer / modifier / supprimer**

Dans le test de `CreerCommunicationCommandHandler`, ajouter :

```ts
    it('crée une NOTIFICATION avec le statut A_ENVOYER et une IN_APP sans statut', async () => {
      // When
      const notification = await handler.handle({ ...commandeNotification })
      const inApp = await handler.handle({ ...commandeInApp })

      // Then
      const [n, i] = await Promise.all([
        CommunicationSqlModel.findByPk(isSuccess(notification) ? notification.data.id : 0),
        CommunicationSqlModel.findByPk(isSuccess(inApp) ? inApp.data.id : 0)
      ])
      expect(n!.statutEnvoi).to.equal(Communication.StatutEnvoi.A_ENVOYER)
      expect(i!.statutEnvoi).to.equal(null)
    })
```

(`commandeNotification` / `commandeInApp` : reprendre les commandes valides déjà définies dans ce fichier de test, quel que soit leur nom.)

Dans le test de `ModifierCommunicationCommandHandler` :

```ts
    it("refuse de modifier une communication dont l'envoi a démarré", async () => {
      // Given
      await existante.update({ statutEnvoi: Communication.StatutEnvoi.EN_COURS })

      // When
      const result = await handler.handle(commandeValide)

      // Then
      expect(isFailure(result) && result.error).to.be.instanceOf(MauvaiseCommandeError)
    })

    it('recale le statut selon le type après modification', async () => {
      // When : passage IN_APP → NOTIFICATION
      await handler.handle({ ...commandeValide, type: Communication.Type.NOTIFICATION, destinataire: Communication.Destinataire.JEUNE, dateFin: undefined, push: true })

      // Then
      const relue = await CommunicationSqlModel.findByPk(existante.id)
      expect(relue!.statutEnvoi).to.equal(Communication.StatutEnvoi.A_ENVOYER)
    })
```

Dans le test de `SupprimerCommunicationCommandHandler` :

```ts
    it("refuse de supprimer une communication dont l'envoi est en cours", async () => {
      // Given
      await existante.update({ statutEnvoi: Communication.StatutEnvoi.EN_COURS })

      // When
      const result = await handler.handle({ id: existante.id })

      // Then
      expect(isFailure(result) && result.error).to.be.instanceOf(MauvaiseCommandeError)
      expect(await CommunicationSqlModel.findByPk(existante.id)).not.to.equal(null)
    })
```

- [ ] **Step 2 : Tests annulation / relance**

`test/application/commands/support/annuler-envoi-communication.command.handler.db.test.ts` :

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { AnnulerEnvoiCommunicationCommandHandler } from '../../../../src/application/commands/support/annuler-envoi-communication.command.handler.db'
import { MauvaiseCommandeError, NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import { isFailure, isSuccess } from '../../../../src/building-blocks/types/result'
import { Communication } from '../../../../src/domain/communication'
import { Notification } from '../../../../src/domain/notification/notification'
import { Planificateur } from '../../../../src/domain/planificateur'
import { CommunicationSqlModel } from '../../../../src/infrastructure/sequelize/models/communication.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { createSandbox, expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('AnnulerEnvoiCommunicationCommandHandler', () => {
  let handler: AnnulerEnvoiCommunicationCommandHandler
  let sandbox: SinonSandbox
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let communication: CommunicationSqlModel

  beforeEach(async () => {
    await getDatabase().cleanPG()
    await PopulationSqlModel.create({ id: 'PHASE_C', description: null })
    communication = await CommunicationSqlModel.create({
      idPopulation: 'PHASE_C',
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      dateDebut: uneDatetime().toJSDate(),
      dateFin: null,
      titre: 'Titre',
      contenu: 'Contenu',
      statutEnvoi: Communication.StatutEnvoi.EN_COURS
    })
    sandbox = createSandbox()
    planificateurRepository = stubInterface(sandbox)
    handler = new AnnulerEnvoiCommunicationCommandHandler(planificateurRepository)
  })

  afterEach(() => sandbox.reset())

  it('passe la communication ANNULEE et supprime les lots planifiés', async () => {
    // When
    const result = await handler.handle({ id: communication.id })

    // Then
    expect(isSuccess(result)).to.equal(true)
    const relue = await CommunicationSqlModel.findByPk(communication.id)
    expect(relue!.statutEnvoi).to.equal(Communication.StatutEnvoi.ANNULEE)
    expect(
      planificateurRepository.supprimerLesJobsSelonPattern
    ).to.have.been.calledOnceWithExactly(
      `ENVOYER_LOT_COMMUNICATION:${communication.id}:`
    )
  })

  it("refuse si l'envoi n'est pas en cours", async () => {
    // Given
    await communication.update({ statutEnvoi: Communication.StatutEnvoi.ENVOYEE })

    // When
    const result = await handler.handle({ id: communication.id })

    // Then
    expect(isFailure(result) && result.error).to.be.instanceOf(MauvaiseCommandeError)
    expect(planificateurRepository.supprimerLesJobsSelonPattern).not.to.have.been.called()
  })

  it('404 si la communication est inconnue', async () => {
    const result = await handler.handle({ id: 999 })
    expect(isFailure(result) && result.error).to.be.instanceOf(NonTrouveError)
  })
})
```

`relancer-envoi-communication.command.handler.db.test.ts` sur le même modèle (setup identique, `statutEnvoi: EN_ERREUR`, handler construit avec `(dateService, planificateurRepository)`, `dateService.now.returns(uneDatetime())`) :

```ts
  it("repasse EN_COURS et enfile un lot avec un numéro basé sur l'horloge", async () => {
    // When
    const result = await handler.handle({ id: communication.id })

    // Then
    expect(isSuccess(result)).to.equal(true)
    const relue = await CommunicationSqlModel.findByPk(communication.id)
    expect(relue!.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_COURS)
    const numeroLot = uneDatetime().toMillis()
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWithExactly(
      {
        dateExecution: uneDatetime().toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: { idCommunication: communication.id, numeroLot, echecsConsecutifs: 0 }
      },
      `ENVOYER_LOT_COMMUNICATION:${communication.id}:${numeroLot}`
    )
  })

  it('relance aussi depuis ANNULEE', async () => {
    await communication.update({ statutEnvoi: Communication.StatutEnvoi.ANNULEE })
    const result = await handler.handle({ id: communication.id })
    expect(isSuccess(result)).to.equal(true)
  })

  it('refuse depuis A_ENVOYER, EN_COURS ou ENVOYEE', async () => {
    for (const statut of [
      Communication.StatutEnvoi.A_ENVOYER,
      Communication.StatutEnvoi.EN_COURS,
      Communication.StatutEnvoi.ENVOYEE
    ]) {
      await communication.update({ statutEnvoi: statut })
      const result = await handler.handle({ id: communication.id })
      expect(isFailure(result) && result.error).to.be.instanceOf(MauvaiseCommandeError)
    }
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
  })

  it('404 si la communication est inconnue', async () => {
    const result = await handler.handle({ id: 999 })
    expect(isFailure(result) && result.error).to.be.instanceOf(NonTrouveError)
  })
```

- [ ] **Step 3 : Vérifier l'échec**

Run: `yarn test:local:db -- --grep 'Communication'`
Expected: FAIL sur les nouveaux cas.

- [ ] **Step 4 : Créer / modifier / supprimer**

`creer-communication.command.handler.db.ts`, dans le `create` : ajouter

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
          `Communication ${command.id} non modifiable : envoi ${existante.statutEnvoi}`
        )
      )
    }
```

et dans le `update`, même champ `statutEnvoi` que ci-dessus (recalculé selon le type).

`supprimer-communication.command.handler.db.ts` : après avoir trouvé la communication, refuser si `statutEnvoi === EN_COURS` :

```ts
    if (existante.statutEnvoi === Communication.StatutEnvoi.EN_COURS) {
      return failure(
        new MauvaiseCommandeError(
          `Communication ${command.id} en cours d'envoi : annuler l'envoi avant de la supprimer`
        )
      )
    }
```

(Adapter au nom de variable du handler existant.)

- [ ] **Step 5 : Annulation**

```ts
import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import { Communication } from '../../../domain/communication'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'

export interface AnnulerEnvoiCommunicationCommand extends Command {
  id: number
}

@Injectable()
export class AnnulerEnvoiCommunicationCommandHandler extends CommandHandler<
  AnnulerEnvoiCommunicationCommand,
  void
> {
  constructor(
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super('AnnulerEnvoiCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: AnnulerEnvoiCommunicationCommand): Promise<Result> {
    const communication = await CommunicationSqlModel.findByPk(command.id)
    if (!communication) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    const transition = Communication.annulerEnvoi(communication.statutEnvoi)
    if (isFailure(transition)) return transition

    await communication.update({ statutEnvoi: transition.data })
    await this.planificateurRepository.supprimerLesJobsSelonPattern(
      `${Planificateur.JobType.ENVOYER_LOT_COMMUNICATION}:${communication.id}:`
    )
    return emptySuccess()
  }
}
```

Le statut est posé **avant** la suppression des jobs : un lot déjà actif au moment de l'annulation se termine (≤ 1 min), et le suivant qu'il enfile se verra ignoré par la vérification `EN_COURS` du handler de lot.

- [ ] **Step 6 : Relance**

```ts
import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import { Communication } from '../../../domain/communication'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'
import { DateService } from '../../../utils/date-service'

export interface RelancerEnvoiCommunicationCommand extends Command {
  id: number
}

@Injectable()
export class RelancerEnvoiCommunicationCommandHandler extends CommandHandler<
  RelancerEnvoiCommunicationCommand,
  void
> {
  constructor(
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super('RelancerEnvoiCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: RelancerEnvoiCommunicationCommand): Promise<Result> {
    const communication = await CommunicationSqlModel.findByPk(command.id)
    if (!communication) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    const transition = Communication.relancerEnvoi(communication.statutEnvoi)
    if (isFailure(transition)) return transition

    const maintenant = this.dateService.now()
    // Numéro de lot hors de la séquence 1, 2, 3… de la chaîne précédente : Bull
    // ignore silencieusement un jobId déjà vu, même terminé.
    const numeroLot = maintenant.toMillis()
    await communication.update({ statutEnvoi: transition.data })
    await this.planificateurRepository.ajouterJob(
      {
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.ENVOYER_LOT_COMMUNICATION,
        contenu: {
          idCommunication: communication.id,
          numeroLot,
          echecsConsecutifs: 0
        }
      },
      Planificateur.jobIdLotCommunication(communication.id, numeroLot)
    )
    return emptySuccess()
  }
}
```

Enregistrer les deux handlers dans `app.module.ts`.

- [ ] **Step 7 : Vérifier**

Run: `yarn test:local:db -- --grep 'Communication'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add src/application/commands/support src/app.module.ts test/application/commands/support
git commit -m "feat(communications): annulation et relance d'un envoi, garde-fous PUT/DELETE"
```

---

### Task 9 : Routes support et suivi dans `GET /support/populations/:id`

**Files:**
- Modify: `src/infrastructure/routes/support-deploiements.controller.ts` (2 routes après `supprimerCommunication`)
- Modify: `src/application/queries/query-models/population-support.query-model.ts`
- Modify: `src/application/queries/get-population-support.query.handler.db.ts`
- Test: `test/infrastructure/routes/support-deploiements.controller.test.ts`, `test/application/queries/get-population-support.query.handler.db.test.ts`

**Interfaces:**
- Produces (query model `CommunicationSupportQueryModel`) :
  ```ts
  statutEnvoi?: Communication.StatutEnvoi
  envoiTermineLe?: string
  envoi?: { total: number; aEnvoyer: number; enCours: number; envoyees: number; erreurs: number; tokensInvalides: number }
  ```

- [ ] **Step 1 : Tests de la query**

Dans le test de `GetPopulationSupportQueryHandler` (le handler reçoit désormais `communicationRepository: Communication.Repository` en dernier paramètre — adapter le constructeur dans le `beforeEach`) :

```ts
    it('expose le statut et les compteurs d’envoi d’une NOTIFICATION démarrée', async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        dateDebut: maintenant.toJSDate(),
        dateFin: null,
        titre: 'Titre',
        contenu: 'Contenu',
        statutEnvoi: Communication.StatutEnvoi.EN_COURS
      })
      communicationRepository.compterEnvois.withArgs(communication.id).resolves({
        A_ENVOYER: 10, EN_COURS: 4, ENVOYEE: 5, ERREUR: 1, TOKEN_INVALIDE: 2
      })

      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })

      // Then
      expect(isSuccess(result) && result.data.communications[0]).to.deep.include({
        statutEnvoi: Communication.StatutEnvoi.EN_COURS,
        envoi: { total: 22, aEnvoyer: 10, enCours: 4, envoyees: 5, erreurs: 1, tokensInvalides: 2 }
      })
    })

    it("n'expose pas de compteurs pour une IN_APP ni pour une NOTIFICATION pas encore démarrée", async () => {
      // Given : une IN_APP et une NOTIFICATION A_ENVOYER (create comme ci-dessus, statutEnvoi null / A_ENVOYER)
      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })
      // Then
      expect(communicationRepository.compterEnvois).not.to.have.been.called()
      const communications = isSuccess(result) ? result.data.communications : []
      expect(communications.every(c => c.envoi === undefined)).to.equal(true)
    })
```

- [ ] **Step 2 : Query model**

Dans `CommunicationSupportQueryModel`, remplacer les champs `statutEnvoi` / `envoiTermineLe` posés en Task 3 par :

```ts
  @ApiPropertyOptional({
    enum: Communication.StatutEnvoi,
    description: 'NOTIFICATION uniquement : A_ENVOYER, EN_COURS, ENVOYEE, ANNULEE, EN_ERREUR'
  })
  statutEnvoi?: Communication.StatutEnvoi

  @ApiPropertyOptional({ description: 'Fin de l’envoi, en UTC' })
  envoiTermineLe?: string

  @ApiPropertyOptional({ type: EnvoiCommunicationSupportQueryModel })
  envoi?: EnvoiCommunicationSupportQueryModel
```

avec, au-dessus de la classe :

```ts
export class EnvoiCommunicationSupportQueryModel {
  @ApiProperty() total: number
  @ApiProperty() aEnvoyer: number
  @ApiProperty({ description: 'Réservés par un lot en cours de traitement' })
  enCours: number
  @ApiProperty() envoyees: number
  @ApiProperty() erreurs: number
  @ApiProperty() tokensInvalides: number
}
```

- [ ] **Step 3 : Query handler**

Injecter `@Inject(CommunicationRepositoryToken) private readonly communicationRepository: Communication.Repository` en dernier paramètre. Dans `handle`, après le `Promise.all`, calculer les compteurs pour les communications dont `statutEnvoi` est non nul et différent de `A_ENVOYER` :

```ts
    const compteursParCommunication = new Map<
      number,
      Record<CommunicationEnvoi.Statut, number>
    >()
    for (const co of communications) {
      if (co.statutEnvoi && co.statutEnvoi !== Communication.StatutEnvoi.A_ENVOYER) {
        compteursParCommunication.set(
          co.id,
          await this.communicationRepository.compterEnvois(co.id)
        )
      }
    }
```

et passer `compteursParCommunication` à `toPopulationSupportQueryModel` (nouveau paramètre) qui produit :

```ts
      statutEnvoi: co.statutEnvoi ?? undefined,
      envoiTermineLe: co.envoiTermineLe
        ? DateTime.fromJSDate(co.envoiTermineLe).toUTC().toISO()!
        : undefined,
      envoi: toEnvoiQueryModel(compteursParCommunication.get(co.id))
```

```ts
function toEnvoiQueryModel(
  compteurs: Record<CommunicationEnvoi.Statut, number> | undefined
): EnvoiCommunicationSupportQueryModel | undefined {
  if (!compteurs) return undefined
  return {
    total:
      compteurs.A_ENVOYER +
      compteurs.EN_COURS +
      compteurs.ENVOYEE +
      compteurs.ERREUR +
      compteurs.TOKEN_INVALIDE,
    aEnvoyer: compteurs.A_ENVOYER,
    enCours: compteurs.EN_COURS,
    envoyees: compteurs.ENVOYEE,
    erreurs: compteurs.ERREUR,
    tokensInvalides: compteurs.TOKEN_INVALIDE
  }
}
```

Vérifier les autres appelants de `toPopulationSupportQueryModel` (`grep -rn toPopulationSupportQueryModel src`) et leur passer `new Map()` si aucun compteur n'est attendu (ex. liste des populations).

- [ ] **Step 4 : Routes**

Dans `support-deploiements.controller.ts`, injecter `AnnulerEnvoiCommunicationCommandHandler` et `RelancerEnvoiCommunicationCommandHandler` dans le constructeur, puis après `supprimerCommunication` :

```ts
  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: "Annule l'envoi en cours d'une communication NOTIFICATION",
    description:
      'Kill switch : la communication passe ANNULEE et les lots planifiés sont retirés de la file. Le lot en cours (≤ 1 min) se termine. Les jeunes déjà notifiés le restent ; relancer reprend là où on s’est arrêté.'
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

  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: "Relance l'envoi d'une communication ANNULEE ou EN_ERREUR",
    description:
      'Reprend l’envoi sur les jeunes non encore traités (statut A_ENVOYER dans le suivi). Ne renvoie jamais à un jeune déjà notifié.'
  })
  @ApiParam({ name: 'idCommunication', example: 3 })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Relancée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "L'envoi n'est ni ANNULEE ni EN_ERREUR" })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'La communication n’existe pas' })
  @Post('communications/:idCommunication/envoi/relance')
  @HttpCode(HttpStatus.NO_CONTENT)
  async relancerEnvoiCommunication(
    @Param('idCommunication', ParseIntPipe) idCommunication: number
  ): Promise<void> {
    const result = await this.relancerEnvoiCommunicationCommandHandler.execute(
      { id: idCommunication },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }
```

Mettre à jour la description de `POST /support/communications` (déjà dans ce fichier) pour mentionner : « une NOTIFICATION est envoyée par le cron du prochain jour ouvré 9h après `dateDebut`, puis suivie via `statutEnvoi` / `envoi` dans `GET /support/populations/:id` ».

- [ ] **Step 5 : Tests du controller**

Dans `test/infrastructure/routes/support-deploiements.controller.test.ts`, sur le modèle des tests de `DELETE /support/communications/:id` déjà présents (stub du handler via `stubClass`, appel `request(app.getHttpServer())`) :

```ts
  describe('POST /support/communications/:id/envoi/annulation', () => {
    it('204 quand le handler réussit', async () => {
      annulerEnvoiCommunicationCommandHandler.execute.resolves(emptySuccess())
      await request(app.getHttpServer())
        .post('/support/communications/3/envoi/annulation')
        .set('X-API-KEY', apiKeySupport)
        .expect(HttpStatus.NO_CONTENT)
      expect(annulerEnvoiCommunicationCommandHandler.execute).to.have.been.calledWithMatch({ id: 3 })
    })

    it('400 quand la transition est refusée', async () => {
      annulerEnvoiCommunicationCommandHandler.execute.resolves(
        failure(new MauvaiseCommandeError('non'))
      )
      await request(app.getHttpServer())
        .post('/support/communications/3/envoi/annulation')
        .set('X-API-KEY', apiKeySupport)
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('POST /support/communications/:id/envoi/relance', () => {
    it('204 quand le handler réussit', async () => {
      relancerEnvoiCommunicationCommandHandler.execute.resolves(emptySuccess())
      await request(app.getHttpServer())
        .post('/support/communications/3/envoi/relance')
        .set('X-API-KEY', apiKeySupport)
        .expect(HttpStatus.NO_CONTENT)
    })
  })
```

(`apiKeySupport` et le mécanisme d'en-tête : reprendre exactement ce que font les tests voisins du fichier.) Enregistrer les deux stubs dans le module de test du controller comme les autres handlers (`buildTestingModuleForHttpTesting` ou équivalent dans `test/utils`).

- [ ] **Step 6 : Vérifier**

Run: `yarn test:local:db -- --grep 'GetPopulationSupportQueryHandler'`, `yarn test:local:unit -- --grep 'SupportDeploiementsController'` puis `yarn tsc --noEmit && yarn lint`
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/infrastructure/routes/support-deploiements.controller.ts src/application/queries test
git commit -m "feat(communications): routes support annulation/relance et suivi d'envoi"
```

---

### Task 10 : Supprimer `NOTIFIER_BENEFICIAIRES` et la route support

**Files:**
- Delete: `src/application/commands/notifier-beneficiaires.command.handler.ts`, `src/application/jobs/notifier-beneficiaires.job.handler.db.ts`, `test/application/commands/notifier-beneficiaires.command.handler.test.ts`, `test/application/jobs/notifier-beneficiaires.job.handler.db.test.ts`
- Modify: `src/infrastructure/routes/support.controller.ts` (route `notifier-beneficiaires` + import + injection ; garder `job-information/:jobId`), `src/infrastructure/routes/validation/support.inputs.ts` (`NotifierBeneficiairesPayload`), `test/infrastructure/routes/support.controller.test.ts`
- Modify: `src/app.module.ts` (2 providers + imports)
- Modify: `src/domain/planificateur.ts` (`JobType.NOTIFIER_BENEFICIAIRES`, `JobNotifierBeneficiaires`, `StatsJobNotif`, `ParamsJobNotif`, `Repository.recupererPremierJobNonTermine`)
- Modify: `src/domain/suivi-job.ts` (retirer `NOTIFIER_BENEFICIAIRES` de `estJobSuivi`)
- Modify: `src/infrastructure/repositories/planificateur-redis.repository.db.ts` (`recupererPremierJobNonTermine`, `recupererJobsNonTermines`), `test/infrastructure/repositories/planificateur-redis.repository.db.test.ts`
- Modify: `src/application/queries/query-models/population-support.query-model.ts` (toute mention de `notifier-beneficiaires` dans une description Swagger)
- Modify: `docs/TROUBLESHOOT.md:28`

- [ ] **Step 1 : Supprimer les fichiers et références**

```bash
git rm src/application/commands/notifier-beneficiaires.command.handler.ts \
       src/application/jobs/notifier-beneficiaires.job.handler.db.ts \
       test/application/commands/notifier-beneficiaires.command.handler.test.ts \
       test/application/jobs/notifier-beneficiaires.job.handler.db.test.ts
grep -rn "NotifierBeneficiaires\|NOTIFIER_BENEFICIAIRES\|notifier-beneficiaires\|StatsJobNotif\|ParamsJobNotif\|recupererPremierJobNonTermine\|recupererJobsNonTermines" src test docs
```

Traiter chaque occurrence : supprimer la route et son bloc Swagger dans `support.controller.ts` (lignes ~430-465 + import ligne 33 + paramètre du constructeur), la classe `NotifierBeneficiairesPayload` et ses imports devenus inutiles dans `support.inputs.ts`, les tests correspondants dans `support.controller.test.ts`, les types et la méthode d'interface dans `planificateur.ts`, l'implémentation et le test dans le repository Redis, l'entrée d'`estJobSuivi`, la ligne `active -q … NOTIFIER_BENEFICIAIRES` du `TROUBLESHOOT.md` (remplacer par `delayed -q '[.root[] | select(.data.type | contains("ENVOYER_LOT_COMMUNICATION"))]' -e 6000`).

Vérifier ensuite que `MAX_NUMBER_REDIS_JOBS` est encore utilisé dans le repository Redis (oui, par `estEnCoursDeTraitement` et `compterLesJobs`) — le garder.

- [ ] **Step 2 : Vérifier**

Run: `yarn tsc --noEmit && yarn lint && yarn test:local:unit && yarn test:local:db -- --grep 'Planificateur|Support|Communication'`
Expected: PASS, et le `grep` du Step 1 ne renvoie plus rien hors `docs/decisions/` et `docs/superpowers/`.

- [ ] **Step 3 : Commit**

```bash
git add -A src test docs/TROUBLESHOOT.md
git commit -m "refactor(communications): suppression du job NOTIFIER_BENEFICIAIRES et de la route support"
```

---

### Task 11 : Documentation

**Files:**
- Modify: `docs/decisions/ADR-007-communications.md` (décision 10, tableau des routes, section « Reste à faire / Hors de cette ADR »)
- Modify: `CLAUDE.md` (aucun changement attendu — vérifier seulement qu'aucune commande ou variable d'env nouvelle n'y manque : ajouter `JOB_ENVOI_COMMUNICATION_*` uniquement si le fichier liste déjà des variables de jobs ; sinon ne rien ajouter)
- Modify: `.environment.template` (ou l'équivalent listé dans `CLAUDE.md` → section Secrets) : ajouter les 3 variables avec leurs défauts en commentaire

- [ ] **Step 1 : ADR-007**

Décision 10 : remplacer la phrase « Le cron `NOTIFIER_COMMUNICATIONS` envoie … (pas d'envois simultanés qui se chevauchent). » par :

```markdown
    Le cron `NOTIFIER_COMMUNICATIONS` démarre l'envoi dès qu'il voit
    `date_debut` atteinte et `statut_envoi = A_ENVOYER`, **même après plusieurs
    jours de blocage du cron** : pas de garde-fou anti-retard. Une seule
    communication est `EN_COURS` à la fois ; l'envoi lui-même est découpé en
    lots courts (`ENVOYER_LOT_COMMUNICATION`) sur une population figée dans
    `communication_envoi`, ce qui garantit l'absence de doublon en cas de
    rejeu et permet l'annulation et la relance depuis le support. Détail :
    `docs/superpowers/specs/2026-09-17-envoi-communications-design.md`.
```

Tableau des routes : ajouter `POST /support/communications/:id/envoi/annulation` et `…/relance` (204, 400, 404) ; dans la ligne `GET /support/populations/:id`, remplacer `envoyeeLe?` par `statutEnvoi?, envoiTermineLe?, envoi?`. Dans le diagramme ER, remplacer `timestamptz envoyee_le` par `string statut_envoi` + `timestamptz envoi_termine_le`, et ajouter l'entité `communication_envoi`.

Section « Hors de cette ADR » : retirer le point sur « L'optimisation du batching de `NOTIFIER_BENEFICIAIRES` » ; dans « Deuxième étape », remplacer `envoyee_le` par `statut_envoi` / `envoi_termine_le` et `cron NOTIFIER_COMMUNICATIONS` par `cron NOTIFIER_COMMUNICATIONS + job ENVOYER_LOT_COMMUNICATION`.

- [ ] **Step 2 : Template d'environnement**

Repérer le fichier template (`ls -a | grep -i environment`) et ajouter :

```
# Envoi des communications NOTIFICATION par lots (notifs/s et durée d'un lot)
JOB_ENVOI_COMMUNICATION_DEBIT_MIN=1
JOB_ENVOI_COMMUNICATION_DEBIT_MAX=10
JOB_ENVOI_COMMUNICATION_DUREE_LOT_SECONDES=60
```

- [ ] **Step 3 : Vérifier et committer**

Run: `yarn lint` (les `.md` ne sont pas lintés ; vérifier à l'œil que les tableaux restent alignés).

```bash
git add docs/decisions/ADR-007-communications.md .environment.template
git commit -m "docs: ADR-007 envoi par lots, annulation et relance"
```

---

### Task 12 : Vérification finale

- [ ] **Step 1 : Suite complète**

Run: `yarn tsc --noEmit && yarn lint && yarn test`
Expected: tout au vert. Si `yarn test` est trop long en local, `yarn test:local:unit` puis `yarn test:local:db`.

- [ ] **Step 2 : Test de bout en bout sur staging (manuel, après merge sur `develop`)**

1. `yarn tasks:initialiser-les-crons` (post-deploy) pour que `NOTIFIER_COMMUNICATIONS` soit bien planifié.
2. Créer une population de test avec 2-3 jeunes (`POST /support/populations`, `…/conseillers`).
3. `POST /support/communications` type `NOTIFICATION`, `push: false`, `dateDebut` = hier.
4. Déclencher le cron à la main (`GET /support/job-information` ne le permet pas : utiliser la route d'exécution de cron du support si elle existe, sinon `bull-repl` `add`), puis suivre `GET /support/populations/:id` : `statutEnvoi` passe `EN_COURS` puis `ENVOYEE`, `envoi.total` = nombre de jeunes avec token.
5. Refaire avec `push: true` sur soi-même, puis tester `…/envoi/annulation` pendant un envoi plus long et `…/envoi/relance` derrière.

---

## Self-review

- **Multi-workers** : réservation atomique `SKIP LOCKED` (T5), libération des orphelines et terminaison conditionnée à `EN_COURS = 0` (T6), compteur `enCours` exposé (T9).
- **Couverture spec** : modèle (T3), statuts/transitions (T1), débit et créneau (T2), `send` avec résultat (T4), repository (T5), lot (T6), cron sérialisé (T7), garde-fous PUT/DELETE + annulation/relance (T8), routes + suivi (T9), suppression (T10), doc (T11). Exclusion `estJobSuivi`/`estNotifiable` : T6 Step 1. `jobId` déterministe : T6/T7/T8.
- **Cohérence des noms** : `Communication.StatutEnvoi`, `CommunicationEnvoi.Statut`, `CommunicationEnvoi.Bornes`, `calculerDebit(restantes, maintenant, bornes)`, `prochainCreneauOuvre(date)`, `figerPopulationAEnvoyer(idCommunication, idPopulation)`, `reserverProchainsEnvois(idCommunication, limite, maintenant)`, `libererEnvoisBloques(idCommunication, reservesAvant)`, `marquerEnvoi(idCommunication, idJeune, statut, date)`, `compterEnvois(idCommunication)`, `Planificateur.jobIdLotCommunication(idCommunication, numeroLot)`, `JobEnvoyerLotCommunication { idCommunication, numeroLot, echecsConsecutifs }` — identiques dans toutes les tâches.
- **Points à trancher pendant l'exécution** (pas des placeholders, des vérifications) : le nom exact de la population dans le `beforeEach` de `communication.repository.db.test.ts` (T5), le nom du fichier template d'environnement (T11), la façon dont les tests du controller support injectent l'API key (T9).

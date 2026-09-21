# Populations résolues dans la base Analytics — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un job quotidien de la pipeline analytics matérialise `analytics_population_membres` (conseillers et jeunes résolus par population) en appelant le repository de production `PopulationSqlRepository`, pour que Metabase affiche exactement ce que le code calculera — sans réimplémenter la logique d'appartenance.

**Architecture:** `Population.Repository` gagne une méthode symétrique côté conseillers (`getIdsDesConseillersParProfilOuConseillerCite`), à côté de celle des jeunes déjà utilisée en production par `NotifierBeneficiairesJobHandler`. Un nouveau `JobHandler` `CHARGER_POPULATIONS_ANALYTICS` dans `src/application/jobs/analytics/`, enfilé par le job 0 (`DUMP_ANALYTICS`) après le dump, instancie `new PopulationSqlRepository(connexionAnalytics)` — la même classe qu'en prod, pointée sur la base Analytics — et appelle ses deux méthodes pour chaque population. Il enrichit ensuite les identifiants obtenus par une requête de présentation pure (email, nom, prénom, agence), sans prédicat métier. Exposé en task Scalingo `yarn tasks:charger-populations`.

**Tech Stack:** NestJS 11, Sequelize 6 (raw queries), Bull (planificateur), Mocha + Chai + Sinon, `@salesforce/ts-sinon`.

**Spec:** [`../specs/2026-09-17-populations-analytics-design.md`](../specs/2026-09-17-populations-analytics-design.md)

## Global Constraints

- Prettier : `semi: false`, `singleQuote: true`, `trailingComma: none`, `arrowParens: avoid`. String avec apostrophe → doubles guillemets.
- ESLint : pas de `console`, pas de `process.env` hors `connector-analytics.ts` (déjà existant), type de retour explicite sur toute fonction, pas de `any`.
- Pas de commentaire décrivant *ce que fait* le code ; seulement un fait non évident, un `// TODO:` actionnable, ou `// Given / When / Then` dans les tests.
- Vérifications avant chaque commit : `yarn tsc --noEmit` (pas `yarn build`, qui ne typecheck pas les tests), `yarn lint`, et le test concerné (`yarn db:test` doit tourner pour les `.db.test.ts`).
- La base Analytics des tests **est** la base de test : `process.env.DUMP_RESTORE_DB_TARGET = process.env.DATABASE_URL || 'postgresql://test:test@localhost:56432/test'` dans le `before`, comme `test/application/jobs/analytics/initialiser-la-vue-demarches-ia.job.db.test.ts`.
- Commits atomiques, un par tâche, message en français, préfixe `feat(analytics):` / `feat(population):` / `docs(analytics):`, terminé par `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Lancer un seul fichier de test : `TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha <fichier> --exit --timeout 10000`.

---

## Fichiers

| Action | Fichier | Responsabilité |
| --- | --- | --- |
| Modifier | `src/domain/population.ts` | Ajouter `getIdsDesConseillersParProfilOuConseillerCite` à `Population.Repository` |
| Modifier | `src/infrastructure/repositories/population.repository.db.ts` | Implémenter la méthode avec `sqlConseillerDansPopulation` |
| Modifier | `test/infrastructure/repositories/population.repository.db.test.ts` | Tester la nouvelle méthode avec les fixtures existantes |
| Modifier | `src/domain/planificateur.ts` | Ajouter `CHARGER_POPULATIONS_ANALYTICS` à `JobType` |
| Créer | `src/application/jobs/analytics/0bis-charger-les-populations.job.ts` | Le job : appelle `PopulationSqlRepository`, enrichit, écrit `analytics_population_membres` |
| Créer | `test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts` | Test DB du job |
| Modifier | `src/app.module.ts` | Enregistrer le handler |
| Modifier | `src/application/jobs/analytics/0-dump-for-analytics.job.ts` | Enfiler le nouveau job après le dump |
| Créer | `test/application/jobs/analytics/0-dump-for-analytics.job.test.ts` | Test unitaire de l'enfilement |
| Modifier | `package.json` | Script `tasks:charger-populations` |
| Modifier | `docs/ANALYTICS.md` | Étape quotidienne, fraîcheur, reprise, rafraîchissement à la demande |

---

### Task 0 : symétrie côté conseillers dans `Population.Repository`

**Files:**
- Modify: `src/domain/population.ts`
- Modify: `src/infrastructure/repositories/population.repository.db.ts`
- Modify: `test/infrastructure/repositories/population.repository.db.test.ts`

**Interfaces:**
- Consumes : `sqlConseillerDansPopulation(aliasConseiller, idPopulation)` de `src/infrastructure/repositories/sql-helpers.ts` (déjà importé ailleurs, pas encore dans ce fichier).
- Produces : `Population.Repository.getIdsDesConseillersParProfilOuConseillerCite(idPopulation: string): Promise<string[]>`, implémentée sur `PopulationSqlRepository`.

- [ ] **Step 1 : écrire le test qui échoue**

Dans `test/infrastructure/repositories/population.repository.db.test.ts`, ajouter après le bloc `describe('getIdsDesJeunesParProfilOuConseillerCite', ...)` (avant la fermeture du `describe('PopulationSqlRepository', ...)`) :

```ts
  describe('getIdsDesConseillersParProfilOuConseillerCite', () => {
    it('renvoie les conseillers cités par email et ceux dont le propre profil correspond', async () => {
      // When
      const ids = await repo.getIdsDesConseillersParProfilOuConseillerCite('PILOTE')

      // Then
      expect(ids).to.have.members(['conseillerCite', 'conseillerFtCej'])
    })

    it('renvoie une liste vide pour une population inconnue', async () => {
      expect(
        await repo.getIdsDesConseillersParProfilOuConseillerCite('INCONNUE')
      ).to.deep.equal([])
    })
  })
```

`conseillerCite` est cité par email dans la fixture existante (`PopulationConseillerSqlModel.create({ idPopulation: 'PILOTE', emailConseiller: 'cite@milo.fr' })`) ; `conseillerFtCej` correspond par profil (`PopulationProfilSqlModel.create({ idPopulation: 'PILOTE', structure: Profil.Structure.FRANCE_TRAVAIL, dispositif: Profil.Dispositif.CEJ })`, et `conseillerFtCej` a été créé avec `structure: Core.Structure.POLE_EMPLOI` → converti en `FRANCE_TRAVAIL`/`CEJ` par la fixture). `conseillerHors` ne doit apparaître dans aucun des deux cas.

- [ ] **Step 2 : lancer le test, vérifier l'échec**

```bash
yarn db:test
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/infrastructure/repositories/population.repository.db.test.ts --exit --timeout 10000
```

Attendu : échec à la compilation, `repo.getIdsDesConseillersParProfilOuConseillerCite is not a function`.

- [ ] **Step 3 : étendre le domaine**

Dans `src/domain/population.ts`, remplacer :

```ts
export namespace Population {
  // Résolue à la lecture : un conseiller y est s'il est cité par email ou si son propre profil structure × dispositif correspond ; un jeune y est si son propre profil correspond ou si son conseiller de référence est cité par email.
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    // Jeunes dont le profil correspond à la population, ou dont le conseiller de référence y est cité par email.
    getIdsDesJeunesParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
  }
}
```

par :

```ts
export namespace Population {
  // Résolue à la lecture : un conseiller y est s'il est cité par email ou si son propre profil structure × dispositif correspond ; un jeune y est si son propre profil correspond ou si son conseiller de référence est cité par email.
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    // Jeunes dont le profil correspond à la population, ou dont le conseiller de référence y est cité par email.
    getIdsDesJeunesParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
    // Conseillers cités par email, ou dont le propre profil correspond à la population.
    getIdsDesConseillersParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
  }
}
```

- [ ] **Step 4 : implémenter dans le repository SQL**

Dans `src/infrastructure/repositories/population.repository.db.ts`, remplacer l'import :

```ts
import {
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReference
} from './sql-helpers'
```

par :

```ts
import {
  sqlConseillerDansPopulation,
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReference
} from './sql-helpers'
```

Et ajouter la méthode, après `getIdsDesJeunesParProfilOuConseillerCite` :

```ts
  async getIdsDesConseillersParProfilOuConseillerCite(
    idPopulation: string
  ): Promise<string[]> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
        SELECT c.id
        FROM conseiller c
        WHERE ${sqlConseillerDansPopulation('c', ':idPopulation')}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }
```

- [ ] **Step 5 : lancer le test, vérifier le succès**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/infrastructure/repositories/population.repository.db.test.ts --exit --timeout 10000
```

Attendu : tous les tests du fichier PASS (les 4 existants + les 2 nouveaux).

- [ ] **Step 6 : vérifications et commit**

```bash
yarn tsc --noEmit && yarn lint
git add src/domain/population.ts src/infrastructure/repositories/population.repository.db.ts test/infrastructure/repositories/population.repository.db.test.ts
git commit -m "feat(population): getIdsDesConseillersParProfilOuConseillerCite

Symétrique de getIdsDesJeunesParProfilOuConseillerCite, déjà décrite dans
le commentaire du Repository. Prépare la réutilisation de cette classe
par le job analytics de résolution des populations.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 1 : le job `CHARGER_POPULATIONS_ANALYTICS`

**Files:**
- Modify: `src/domain/planificateur.ts`
- Create: `src/application/jobs/analytics/0bis-charger-les-populations.job.ts`
- Create: `test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes : `PopulationSqlRepository` (Task 0, `src/infrastructure/repositories/population.repository.db.ts`), constructeur `(sequelize: Sequelize)`, méthodes `getIdsDesJeunesParProfilOuConseillerCite(idPopulation)` et `getIdsDesConseillersParProfilOuConseillerCite(idPopulation)` — `sqlJoinConseillerDeReference` de `sql-helpers.ts` pour l'enrichissement du conseiller de référence d'un jeune ; `createSequelizeForAnalytics()` de `src/infrastructure/sequelize/connector-analytics.ts` ; `JobHandler`, `SuiviJob`, `DateService`.
- Produces : `Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS`, classe `ChargerLesPopulationsJobHandler` (constructeur `(suiviJobService: SuiviJob.Service, dateService: DateService)`), constante exportée `ANALYTICS_POPULATION_MEMBRES_TABLE_NAME = 'analytics_population_membres'`.

- [ ] **Step 1 : ajouter le `JobType`**

Dans `src/domain/planificateur.ts`, juste après `DUMP_ANALYTICS = 'DUMP_ANALYTICS',` :

```ts
    CHARGER_POPULATIONS_ANALYTICS = 'CHARGER_POPULATIONS_ANALYTICS',
```

- [ ] **Step 2 : écrire le test DB qui échoue**

Créer `test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts` :

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { QueryTypes } from 'sequelize'
import {
  ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
  ChargerLesPopulationsJobHandler
} from '../../../../src/application/jobs/analytics/0bis-charger-les-populations.job'
import { Core } from '../../../../src/domain/core'
import { Planificateur } from '../../../../src/domain/planificateur'
import { Profil } from '../../../../src/domain/profil'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { AgenceSqlModel } from '../../../../src/infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { StructureMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { DateService } from '../../../../src/utils/date-service'
import { uneAgenceDto } from '../../../fixtures/sql-models/agence.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { uneStructureMiloDto } from '../../../fixtures/sql-models/structureMilo.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

interface Membre {
  id_population: string
  type_utilisateur: string
  id_utilisateur: string
  email: string | null
  nom: string
  prenom: string
  structure: string
  dispositif: string | null
  agence: string | null
  email_conseiller_reference: string | null
  type_conseiller_reference: string | null
  date_calcul: Date
}

describe('ChargerLesPopulationsJobHandler', () => {
  let handler: ChargerLesPopulationsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>
  const maintenant = DateTime.fromISO('2026-09-17T03:00:00.000Z')

  before(async () => {
    await getDatabase().cleanPG()
    // La base analytics des jobs est la base de test
    process.env.DUMP_RESTORE_DB_TARGET =
      process.env.DATABASE_URL || 'postgresql://test:test@localhost:56432/test'

    const sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new ChargerLesPopulationsJobHandler(suiviJobService, dateService)

    await StructureMiloSqlModel.create(
      uneStructureMiloDto({ id: 'ML-07', nomOfficiel: 'ML Aubenas' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({ id: 'FT-06', nomAgence: 'Agence Nice' })
    )
    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'cite@milo.fr',
        nom: 'Citee',
        prenom: 'Camille',
        idStructureMilo: 'ML-07'
      }),
      unConseillerDto({
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr',
        idAgence: 'FT-06'
      }),
      unConseillerDto({
        id: 'conseillerHors',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    // Le profil du jeune est le sien, pas celui de son conseiller : il est posé explicitement.
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'jeune.cite@mail.fr',
        nom: 'Cite',
        prenom: 'Jean',
        idStructureMilo: 'ML-07'
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerHors',
        idConseillerInitial: 'conseillerCite',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneFtCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneCejChezHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneBrsaChezCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.MILO
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: 'Pilote' },
      { id: 'VIDE', description: 'Personne' }
    ])
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })
    await PopulationProfilSqlModel.create({
      idPopulation: 'PILOTE',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.CEJ
    })
  })

  after(async () => {
    await getDatabase().sequelize.query(
      `DROP TABLE IF EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};`
    )
  })

  describe('handle', () => {
    let suiviJob: SuiviJob

    before(async () => {
      // Given : une ligne périmée qui doit disparaître au rebuild
      await handler.handle()
      await getDatabase().sequelize.query(`
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence, email_conseiller_reference, type_conseiller_reference, date_calcul)
        VALUES ('PILOTE', 'JEUNE', 'jeunePerime', NULL, 'Perime', 'Paul', 'MILO', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z');
      `)

      // When
      suiviJob = await handler.handle()
    })

    it('renvoie un suivi de job en succès avec la volumétrie', () => {
      // Then
      expect(suiviJob.succes).to.equal(true)
      expect(suiviJob.jobType).to.equal(
        Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS
      )
      expect(suiviJob.resultat).to.deep.equal({
        nbPopulations: 2,
        nbConseillers: 2,
        nbJeunes: 4
      })
    })

    it('résout les conseillers via PopulationSqlRepository.getIdsDesConseillersParProfilOuConseillerCite', async () => {
      // Then
      const conseillers = await membres('CONSEILLER')
      expect(conseillers.map(m => m.id_utilisateur)).to.deep.equal([
        'conseillerCite',
        'conseillerFtCej'
      ])
      expect(conseillers[0]).to.deep.include({
        id_population: 'PILOTE',
        email: 'cite@milo.fr',
        nom: 'Citee',
        prenom: 'Camille',
        structure: 'MILO',
        agence: 'ML Aubenas',
        email_conseiller_reference: null,
        type_conseiller_reference: null,
        date_calcul: maintenant.toJSDate()
      })
      expect(conseillers[1]).to.deep.include({
        structure: 'FRANCE_TRAVAIL',
        dispositif: 'CEJ',
        agence: 'Agence Nice'
      })
    })

    it('résout les jeunes via PopulationSqlRepository.getIdsDesJeunesParProfilOuConseillerCite, avec leur conseiller de référence', async () => {
      // Then
      const jeunes = await membres('JEUNE')
      expect(
        jeunes.map(m => [
          m.id_utilisateur,
          m.email_conseiller_reference,
          m.type_conseiller_reference
        ])
      ).to.deep.equal([
        ['jeuneCejChezHors', 'hors@milo.fr', 'ACTUEL'],
        ['jeuneCite', 'cite@milo.fr', 'ACTUEL'],
        ['jeuneFtCej', 'ftcej@ft.fr', 'ACTUEL'],
        ['jeuneTransfere', 'cite@milo.fr', 'INITIAL']
      ])
      expect(jeunes.every(m => m.id_population === 'PILOTE')).to.equal(true)
    })

    it("renseigne l'identité et le lieu d'accompagnement du jeune, le sien sinon celui de son conseiller de référence", async () => {
      // Then
      const jeunes = await membres('JEUNE')
      expect(jeunes.find(m => m.id_utilisateur === 'jeuneCite')).to.deep.include({
        email: 'jeune.cite@mail.fr',
        nom: 'Cite',
        prenom: 'Jean',
        structure: 'MILO',
        agence: 'ML Aubenas'
      })
      expect(jeunes.find(m => m.id_utilisateur === 'jeuneFtCej')).to.deep.include({
        structure: 'FRANCE_TRAVAIL',
        dispositif: 'CEJ',
        agence: 'Agence Nice'
      })
    })

    it('repart de zéro à chaque run', async () => {
      // Then
      const lignes = await membres('JEUNE')
      expect(lignes.map(m => m.id_utilisateur)).not.to.include('jeunePerime')
      expect(
        lignes.every(m => m.date_calcul.getTime() === maintenant.toMillis())
      ).to.equal(true)
    })
  })
})

async function membres(typeUtilisateur: string): Promise<Membre[]> {
  return getDatabase().sequelize.query<Membre>(
    `SELECT * FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
     WHERE type_utilisateur = '${typeUtilisateur}'
     ORDER BY id_utilisateur`,
    { type: QueryTypes.SELECT }
  )
}
```

Points à savoir : `unConseillerDto` / `unJeuneDto` prennent une `structure` **legacy** (`Core.Structure.POLE_EMPLOI` → colonnes `structure='FRANCE_TRAVAIL'`, `dispositif='CEJ'` ; `POLE_EMPLOI_BRSA` → `dispositif='BRSA'`, donc `jeuneBrsaChezCej` est **hors** population). Le jeu de données et les 4 jeunes attendus sont **volontairement identiques** à `test/infrastructure/repositories/population.repository.db.test.ts` (Task 0) : c'est la preuve visible que le job appelle la même résolution.

- [ ] **Step 3 : lancer le test, vérifier l'échec**

```bash
yarn db:test
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts --exit --timeout 10000
```

Attendu : échec à la compilation ts-node, `Cannot find module '.../0bis-charger-les-populations.job'`.

- [ ] **Step 4 : écrire le handler**

Créer `src/application/jobs/analytics/0bis-charger-les-populations.job.ts` :

```ts
import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import { Planificateur, ProcessJobType } from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { PopulationSqlRepository } from '../../../infrastructure/repositories/population.repository.db'
import { sqlJoinConseillerDeReference } from '../../../infrastructure/repositories/sql-helpers'
import { createSequelizeForAnalytics } from '../../../infrastructure/sequelize/connector-analytics'
import { DateService } from '../../../utils/date-service'

export const ANALYTICS_POPULATION_MEMBRES_TABLE_NAME =
  'analytics_population_membres'

interface Volumetrie {
  nbPopulations: number
  nbConseillers: number
  nbJeunes: number
}

interface MembreAEcrire {
  idPopulation: string
  typeUtilisateur: 'CONSEILLER' | 'JEUNE'
  idUtilisateur: string
}

/**
 * Analytics pipeline — step 0bis (quotidien, en parallèle du job 1).
 * Matérialise les membres résolus de chaque population en appelant
 * PopulationSqlRepository (la classe de production utilisée par
 * NotifierBeneficiairesJobHandler pour l'envoi de masse), pointée sur la
 * base Analytics : la résolution d'appartenance n'est jamais réimplémentée
 * ici, seul l'enrichissement présentation (email, nom, agence) l'est.
 * @see docs/ANALYTICS.md#0bis-charger-les-populationsjobts
 * @analytics.trigger ajouterJob depuis DUMP_ANALYTICS, ou TASK_NAME=CHARGER_POPULATIONS_ANALYTICS
 * @analytics.after DUMP_ANALYTICS
 * @analytics.tables_in population, population_conseiller, population_profil, conseiller, jeune
 * @analytics.tables_out analytics_population_membres
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS)
export class ChargerLesPopulationsJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService
  ) {
    super(Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    let erreur
    let volumetrie: Volumetrie | undefined
    const maintenant = this.dateService.now()
    try {
      const connexion = await createSequelizeForAnalytics()
      await this.creerLaTable(connexion)
      const populationRepository = new PopulationSqlRepository(connexion)

      const idsPopulations = await this.recupererLesIdsDesPopulations(connexion)
      const membres: MembreAEcrire[] = []
      for (const idPopulation of idsPopulations) {
        const idsConseillers =
          await populationRepository.getIdsDesConseillersParProfilOuConseillerCite(
            idPopulation
          )
        const idsJeunes =
          await populationRepository.getIdsDesJeunesParProfilOuConseillerCite(
            idPopulation
          )
        membres.push(
          ...idsConseillers.map(idUtilisateur => ({
            idPopulation,
            typeUtilisateur: 'CONSEILLER' as const,
            idUtilisateur
          })),
          ...idsJeunes.map(idUtilisateur => ({
            idPopulation,
            typeUtilisateur: 'JEUNE' as const,
            idUtilisateur
          }))
        )
      }

      volumetrie = await connexion.transaction(async transaction => {
        await connexion.query(
          `DELETE FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};`,
          { transaction }
        )
        await this.ecrireLesMembres(connexion, membres, maintenant.toJSDate(), transaction)
        return {
          nbPopulations: idsPopulations.length,
          nbConseillers: membres.filter(m => m.typeUtilisateur === 'CONSEILLER').length,
          nbJeunes: membres.filter(m => m.typeUtilisateur === 'JEUNE').length
        }
      })
      await connexion.close()
    } catch (e) {
      erreur = e
      this.logger.error(e)
    }

    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: !erreur,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: volumetrie ?? {}
    }
  }

  private async creerLaTable(connexion: Sequelize): Promise<void> {
    await connexion.query(`
      CREATE TABLE IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
      (
        id_population              varchar     NOT NULL,
        type_utilisateur           varchar     NOT NULL,
        id_utilisateur             varchar     NOT NULL,
        email                      varchar,
        nom                        varchar,
        prenom                     varchar,
        structure                  varchar,
        dispositif                 varchar,
        agence                     varchar,
        email_conseiller_reference varchar,
        type_conseiller_reference  varchar,
        date_calcul                timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}_id_population_index
        ON ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME} (id_population);
    `)
  }

  private async recupererLesIdsDesPopulations(
    connexion: Sequelize
  ): Promise<string[]> {
    const rows = await connexion.query<{ id: string }>(
      `SELECT id FROM population;`,
      { type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }

  // Présentation pure : ni sqlConseillerDansPopulation ni sqlJeuneDansPopulation
  // n'interviennent ici, l'appartenance est déjà tranchée par PopulationSqlRepository.
  private async ecrireLesMembres(
    connexion: Sequelize,
    membres: MembreAEcrire[],
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<void> {
    if (membres.length === 0) return

    const idsConseillers = membres
      .filter(m => m.typeUtilisateur === 'CONSEILLER')
      .map(m => m.idUtilisateur)
    const idsJeunes = membres
      .filter(m => m.typeUtilisateur === 'JEUNE')
      .map(m => m.idUtilisateur)

    if (idsConseillers.length > 0) {
      await connexion.query(
        `
          INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
            (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence,
             email_conseiller_reference, type_conseiller_reference, date_calcul)
          SELECT m.id_population, 'CONSEILLER', c.id, c.email, c.nom, c.prenom, c.structure, c.dispositif,
                 COALESCE(sm.nom_officiel, a.nom_agence),
                 NULL, NULL, :dateCalcul
          FROM (VALUES ${membres
            .filter(m => m.typeUtilisateur === 'CONSEILLER')
            .map(m => `('${m.idPopulation}', '${m.idUtilisateur}')`)
            .join(', ')}) AS m(id_population, id_utilisateur)
          JOIN conseiller c ON c.id = m.id_utilisateur
          LEFT JOIN structure_milo sm ON sm.id = c.id_structure_milo
          LEFT JOIN agence a ON a.id = c.id_agence;
        `,
        { replacements: { dateCalcul }, transaction }
      )
    }

    if (idsJeunes.length > 0) {
      await connexion.query(
        `
          INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
            (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence,
             email_conseiller_reference, type_conseiller_reference, date_calcul)
          SELECT m.id_population, 'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
                 COALESCE(smj.nom_officiel, smc.nom_officiel, a.nom_agence),
                 c.email,
                 CASE WHEN j.id_conseiller_initial IS NULL THEN 'ACTUEL' ELSE 'INITIAL' END,
                 :dateCalcul
          FROM (VALUES ${membres
            .filter(m => m.typeUtilisateur === 'JEUNE')
            .map(m => `('${m.idPopulation}', '${m.idUtilisateur}')`)
            .join(', ')}) AS m(id_population, id_utilisateur)
          JOIN jeune j ON j.id = m.id_utilisateur
          ${sqlJoinConseillerDeReference('j', 'c')}
          LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
          LEFT JOIN structure_milo smc ON smc.id = c.id_structure_milo
          LEFT JOIN agence a ON a.id = c.id_agence;
        `,
        { replacements: { dateCalcul }, transaction }
      )
    }
  }
}
```

Pourquoi cette forme : les `idsConseillers` / `idsJeunes` viennent de `PopulationSqlRepository` (Task 0), donc de la même requête que celle utilisée en production — `ecrireLesMembres` ne fait plus que joindre ces identifiants à `conseiller` / `jeune` / `structure_milo` / `agence` pour l'affichage. Les identifiants sont interpolés directement dans le SQL (pas de `replacements` tableau) parce qu'ils viennent tous d'IDs internes déjà validés par Postgres (existants dans `conseiller`/`jeune`), jamais d'une saisie utilisateur ; si ce point inquiète en revue, remplacer par `WHERE c.id = ANY(:ids)` avec un `replacements: { ids: idsConseillers }` par population plutôt qu'un `VALUES` global — au prix d'une requête par population au lieu d'une seule pour tous les conseillers.

- [ ] **Step 5 : enregistrer le handler dans `app.module.ts`**

Ajouter l'import (à côté de `ChargerLesVuesJobHandler`) :

```ts
import { ChargerLesPopulationsJobHandler } from './application/jobs/analytics/0bis-charger-les-populations.job'
```

Et dans la liste des providers, à côté de `ChargerLesVuesJobHandler,` :

```ts
  ChargerLesPopulationsJobHandler,
```

- [ ] **Step 6 : lancer le test, vérifier le succès**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts --exit --timeout 10000
```

Attendu : 5 tests PASS. Si le `VALUES (...)` est vide pour un des deux blocs (aucun conseiller ou aucun jeune dans aucune population), le `if (ids....length > 0)` l'évite déjà — vérifier que ce cas est bien couvert par la population `VIDE` (aucun membre, donc pas de branche à exercer côté `VIDE` seul, mais `PILOTE` fournit les deux).

- [ ] **Step 7 : vérifications et commit**

```bash
yarn tsc --noEmit && yarn lint
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/infrastructure/repositories/population.repository.db.test.ts --exit --timeout 10000
git add src/domain/planificateur.ts src/application/jobs/analytics/0bis-charger-les-populations.job.ts test/application/jobs/analytics/0bis-charger-les-populations.job.db.test.ts src/app.module.ts
git commit -m "feat(analytics): job CHARGER_POPULATIONS_ANALYTICS

Matérialise analytics_population_membres en appelant PopulationSqlRepository
(getIdsDesConseillersParProfilOuConseillerCite / getIdsDesJeunesParProfilOuConseillerCite)
pointé sur la base Analytics : la résolution d'appartenance passe par la
classe de production, jamais réimplémentée dans le job. Seul l'enrichissement
présentation (email, nom, agence) est propre à ce job.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2 : enfiler le job après le dump

**Files:**
- Modify: `src/application/jobs/analytics/0-dump-for-analytics.job.ts`
- Create: `test/application/jobs/analytics/0-dump-for-analytics.job.test.ts`

**Interfaces:**
- Consumes : `Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS` (Task 1), `DumpForAnalyticsJobHandler(suiviJobService, dateService, planificateurRepository)` existant.
- Produces : rien de nouveau.

- [ ] **Step 1 : écrire le test unitaire qui échoue**

Le job 0 n'a pas de test aujourd'hui : il shelle `yarn run dump-restore-db`. On stubbe `exec` de `node:child_process`.

Créer `test/application/jobs/analytics/0-dump-for-analytics.job.test.ts` :

```ts
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import * as childProcess from 'node:child_process'
import { SinonSandbox, SinonStub } from 'sinon'
import { DumpForAnalyticsJobHandler } from '../../../../src/application/jobs/analytics/0-dump-for-analytics.job'
import { Planificateur } from '../../../../src/domain/planificateur'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { DateService } from '../../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('DumpForAnalyticsJobHandler', () => {
  let sandbox: SinonSandbox
  let handler: DumpForAnalyticsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  let exec: SinonStub
  const maintenant = DateTime.fromISO('2026-09-17T02:30:00.000Z')

  beforeEach(() => {
    sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())
    exec = sandbox
      .stub(childProcess, 'exec')
      .yields(null, { stdout: 'dump OK', stderr: '' })
    handler = new DumpForAnalyticsJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('lance le dump puis enfile le chargement des événements et des populations', async () => {
    // When
    const suiviJob = await handler.handle()

    // Then
    expect(suiviJob.succes).to.equal(true)
    expect(exec).to.have.been.calledOnce()
    expect(planificateurRepository.ajouterJob).to.have.been.calledTwice()
    expect(planificateurRepository.ajouterJob).to.have.been.calledWithExactly({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.CHARGER_EVENEMENTS_ANALYTICS,
      contenu: undefined
    })
    expect(planificateurRepository.ajouterJob).to.have.been.calledWithExactly({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS,
      contenu: undefined
    })
  })
})
```

- [ ] **Step 2 : lancer le test, vérifier l'échec**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/analytics/0-dump-for-analytics.job.test.ts --exit --timeout 10000
```

Attendu : FAIL sur `calledTwice` (appelé une seule fois). Si l'échec est ailleurs (par ex. `exec` non stubbable, `TypeError: Cannot redefine property`), passer le handler à `import * as childProcess from 'node:child_process'` + `promisify(childProcess.exec)` — même comportement runtime, mais stub garanti — et relancer.

- [ ] **Step 3 : enfiler le job dans le handler**

Dans `src/application/jobs/analytics/0-dump-for-analytics.job.ts`, remplacer le bloc qui enfile `CHARGER_EVENEMENTS_ANALYTICS` :

```ts
    const jobChargementAnalytics: Planificateur.Job<void> = {
      dateExecution: this.dateService.nowJs(),
      type: Planificateur.JobType.CHARGER_EVENEMENTS_ANALYTICS,
      contenu: undefined
    }
    await this.planificateurRepository.ajouterJob(jobChargementAnalytics)
```

par :

```ts
    for (const type of [
      Planificateur.JobType.CHARGER_EVENEMENTS_ANALYTICS,
      Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS
    ]) {
      const job: Planificateur.Job<void> = {
        dateExecution: this.dateService.nowJs(),
        type,
        contenu: undefined
      }
      await this.planificateurRepository.ajouterJob(job)
    }
```

Et dans le JSDoc en tête de fichier, remplacer `@analytics.before CHARGER_EVENEMENTS_ANALYTICS` par :

```ts
 * @analytics.before CHARGER_EVENEMENTS_ANALYTICS, CHARGER_POPULATIONS_ANALYTICS
```

- [ ] **Step 4 : lancer le test, vérifier le succès**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test yarn mocha test/application/jobs/analytics/0-dump-for-analytics.job.test.ts --exit --timeout 10000
```

Attendu : 1 test PASS.

- [ ] **Step 5 : vérifications et commit**

```bash
yarn tsc --noEmit && yarn lint
git add src/application/jobs/analytics/0-dump-for-analytics.job.ts test/application/jobs/analytics/0-dump-for-analytics.job.test.ts
git commit -m "feat(analytics): enfiler CHARGER_POPULATIONS_ANALYTICS après le dump

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3 : task Scalingo et documentation

**Files:**
- Modify: `package.json`
- Modify: `docs/ANALYTICS.md`

**Interfaces:**
- Consumes : `TASK_NAME=CHARGER_POPULATIONS_ANALYTICS` (Task 1).

- [ ] **Step 1 : ajouter le script**

Dans `package.json`, après la ligne `"tasks:charger-evenements": …` :

```json
    "tasks:charger-populations": "IS_WEB=false TASK_NAME=CHARGER_POPULATIONS_ANALYTICS node dist/main",
```

Vérifier que le `TASK_NAME` est reconnu (échec attendu sur la connexion Analytics en local, pas sur `Unknown task`) :

```bash
yarn build && DUMP_RESTORE_DB_TARGET=postgresql://test:test@localhost:56432/test dotenv -e .environment yarn tasks:charger-populations
```

- [ ] **Step 2 : mettre à jour `docs/ANALYTICS.md`**

Tableau « Fraîcheur des données », ajouter une ligne :

```markdown
| `analytics_population_membres` (conseillers et jeunes résolus par population) | Quotidien, après le dump (job 0bis) |
```

Liste « Pipeline quotidienne », ajouter un item après le job 0 (renuméroter les suivants) :

```markdown
2. [0bis-charger-les-populations.job.ts](../src/application/jobs/analytics/0bis-charger-les-populations.job.ts) — résolution des populations (conseillers et jeunes) pour Metabase, en parallèle du job 1
```

Section « Ordonnancement », remplacer la puce sur l'enfilement après le job 0 par :

```markdown
- A l'issue du job, deux jobs sont créés dans le worker : charger les événements (job 1, qui enchaîne la suite) et charger les populations (job 0bis, indépendant).
```

Tableau « Reprise en cas d'échec », ajouter une ligne :

```markdown
| Job 0bis échoue (populations) | `analytics_population_membres` garde le contenu de la veille (rebuild transactionnel) | Relancer via `yarn tasks:charger-populations` |
```

Section « Que font les jobs ? », ajouter après `### 0-dump-for-analytics.job.ts` :

```markdown
### 0bis-charger-les-populations.job.ts

Reconstruit `analytics_population_membres` : pour chaque population, les conseillers et
les jeunes qu'elle résout, avec leur identité (email, nom, prénom), leur profil
(structure × dispositif), leur lieu d'accompagnement (`agence` : structure MiLo ou
agence FT) et, pour un jeune, l'email de son conseiller de référence et
`type_conseiller_reference` (`ACTUEL`, ou `INITIAL` si un transfert temporaire est en
cours).

La résolution d'appartenance n'est **pas réimplémentée** dans ce job : il instancie
`PopulationSqlRepository` — la classe utilisée en production par
`NotifierBeneficiairesJobHandler` pour décider qui reçoit une notification ou une
communication — pointée sur la base Analytics, et appelle
`getIdsDesConseillersParProfilOuConseillerCite` / `getIdsDesJeunesParProfilOuConseillerCite`.
Ce que Metabase affiche est donc structurellement ce que l'API calculera, y compris si la
règle de résolution évolue. Seul l'enrichissement présentation (email, nom, agence) est
propre à ce job, sans prédicat métier. Pas d'historique : `DELETE` + `INSERT` dans une
transaction, `date_calcul` identique sur toutes les lignes du run.

Tout le reste (populations, emails cités, profils, déploiements, communications à venir)
se lit directement dans les tables dumpées, sans logique à recopier côté Metabase.
Requêtes de départ pour les questions Metabase :

\`\`\`sql
-- Populations avec leurs effectifs résolus
SELECT p.id, p.description,
       count(*) FILTER (WHERE m.type_utilisateur = 'CONSEILLER') AS nb_conseillers,
       count(*) FILTER (WHERE m.type_utilisateur = 'JEUNE')      AS nb_jeunes,
       max(m.date_calcul)                                         AS calcule_le
FROM population p
LEFT JOIN analytics_population_membres m ON m.id_population = p.id
GROUP BY p.id, p.description
ORDER BY p.id;

-- Membres d'une population (filtre Metabase sur {{id_population}} et {{type_utilisateur}})
SELECT type_utilisateur, email, nom, prenom, structure, dispositif, agence,
       email_conseiller_reference, type_conseiller_reference
FROM analytics_population_membres
WHERE id_population = {{id_population}}
ORDER BY type_utilisateur, nom, prenom;

-- Communications à venir ou en cours, avec les effectifs ciblés
SELECT co.id, co.id_population, co.destinataire, co.type, co.type_notification,
       co.date_debut, co.date_fin, co.titre, co.envoyee_le,
       count(m.id_utilisateur) AS nb_cibles
FROM communication co
LEFT JOIN analytics_population_membres m
       ON m.id_population = co.id_population
      AND m.type_utilisateur = co.destinataire
WHERE co.date_fin IS NULL OR co.date_fin > now()
GROUP BY co.id
ORDER BY co.date_debut;

-- Déploiements à venir, avec les effectifs ciblés
SELECT d.id, d.id_population, d.nature, d.id_fonctionnalite, d.date_activation,
       count(*) FILTER (WHERE m.type_utilisateur = 'CONSEILLER') AS nb_conseillers,
       count(*) FILTER (WHERE m.type_utilisateur = 'JEUNE')      AS nb_jeunes
FROM deploiement d
LEFT JOIN analytics_population_membres m ON m.id_population = d.id_population
WHERE d.date_activation > now()
GROUP BY d.id
ORDER BY d.date_activation;
\`\`\`

**Rafraîchir avant l'heure** (dry-run après avoir modifié une population) : le job lit les
tables **dumpées**, il faut donc re-dumper d'abord — le dump complet dépasse parfois
20 minutes et rend les dashboards incohérents pendant la restauration :

\`\`\`bash
scalingo --app pass-emploi-api-prod run yarn tasks:dump-analytics
scalingo --app pass-emploi-api-prod run yarn tasks:charger-populations
\`\`\`

(`tasks:dump-analytics` enfile lui-même le job 0bis ; la seconde commande n'est utile que
si l'on veut attendre le résultat dans le terminal.)
```

- [ ] **Step 3 : vérifications et commit**

```bash
yarn lint
git add package.json docs/ANALYTICS.md
git commit -m "docs(analytics): job 0bis populations et task charger-populations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Après le plan (hors repo)

- Déployer, puis lancer une fois `scalingo --app pass-emploi-api-prod run yarn tasks:charger-populations` pour ne pas attendre 2h30 (la table est créée par le job).
- Dans Metabase (`stats`), créer les questions à partir des requêtes de `docs/ANALYTICS.md` (populations et effectifs, membres filtrables par population et type, communications à venir, déploiements à venir) et les regrouper dans un dashboard « Populations & déploiements ». Afficher `calcule_le` pour rendre la fraîcheur J-1 visible.

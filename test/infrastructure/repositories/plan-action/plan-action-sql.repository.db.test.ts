import { DateTime } from 'luxon'
import { PlanActionSqlRepository } from '../../../../src/infrastructure/repositories/plan-action/plan-action-sql.repository.db'
import { ConseillerSqlRepository } from '../../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { JeuneSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-sql.repository.db'
import { PlanActionTacheSqlModel } from '../../../../src/infrastructure/sequelize/models/plan-action-tache.sql-model'
import { ReferentielPlanActionTacheSqlModel } from '../../../../src/infrastructure/sequelize/models/referentiel-plan-action-tache.sql-model'
import {
  DestinationActionPlan,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../../../src/application/queries/query-models/plan-action.query-model'
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { IdService } from '../../../../src/utils/id-service'
import { DateService } from '../../../../src/utils/date-service'
import { FirebaseClient } from '../../../../src/infrastructure/clients/firebase-client'
import { uneDatetime } from '../../../fixtures/date.fixture'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

const maintenant = uneDatetime()

function unPlan(
  args: Partial<PlanActionQueryModel> = {}
): PlanActionQueryModel {
  return {
    id: 'plan-1',
    accroche: 'Salut !',
    genereLe: '2026-07-20T22:03:52.448Z',
    generateur: 'fallback',
    objectives: [
      {
        id: 'objectif-1',
        titre: 'Trouver une alternance',
        theme: 'apprenticeship',
        actions: [
          {
            id: 'tache-1',
            libelle: 'Je fais une action',
            type: TypeActionPlan.CONSEIL
          },
          {
            id: 'tache-2',
            libelle: "Je vais sur l'appli",
            type: TypeActionPlan.NAVIGATION,
            destination: DestinationActionPlan.EVENEMENTS,
            nomService: 'Service civique'
          }
        ]
      }
    ],
    ...args
  }
}

describe('PlanActionSqlRepository', () => {
  let database: DatabaseForTesting
  before(async () => {
    database = getDatabase()
  })

  let planActionSqlRepository: PlanActionSqlRepository
  let idService: StubbedClass<IdService>
  let dateService: StubbedClass<DateService>

  beforeEach(async () => {
    await database.cleanPG()
    idService = stubClass(IdService)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)

    planActionSqlRepository = new PlanActionSqlRepository(
      idService,
      dateService,
      database.sequelize
    )

    const conseillerRepository = new ConseillerSqlRepository()
    await conseillerRepository.save(unConseiller())
    const firebaseClient = stubClass(FirebaseClient)
    const jeuneRepository = new JeuneSqlRepository(
      database.sequelize,
      firebaseClient,
      idService,
      dateService
    )
    await jeuneRepository.save(unJeune())
  })

  describe('.save(idJeune, plan)', () => {
    it('sauvegarde le plan, ses objectifs et ses tâches', async () => {
      // Given
      idService.uuid
        .onFirstCall()
        .returns('11111111-1111-1111-1111-111111111111')
        .onSecondCall()
        .returns('22222222-2222-2222-2222-222222222222')
      const plan = unPlan()

      // When
      await planActionSqlRepository.save('ABCDE', plan)

      // Then
      const actual = await planActionSqlRepository.getDernierPlan('ABCDE')
      expect(actual).to.deep.equal({
        id: 'plan-1',
        objectives: [
          {
            id: 'objectif-1',
            titre: 'Trouver une alternance',
            theme: 'apprenticeship',
            actions: [
              {
                id: 'tache-1',
                libelle: 'Je fais une action',
                type: TypeActionPlan.CONSEIL
              },
              {
                id: 'tache-2',
                libelle: "Je vais sur l'appli",
                type: TypeActionPlan.NAVIGATION,
                destination: DestinationActionPlan.EVENEMENTS,
                nomService: 'Service civique'
              }
            ]
          }
        ]
      })
    })

    it('ne duplique pas une tâche déjà présente au référentiel', async () => {
      // Given
      idService.uuid
        .onFirstCall()
        .returns('11111111-1111-1111-1111-111111111111')
        .onSecondCall()
        .returns('22222222-2222-2222-2222-222222222222')
        .onThirdCall()
        .returns('33333333-3333-3333-3333-333333333333')
      const premierPlan = unPlan()
      await planActionSqlRepository.save('ABCDE', premierPlan)

      // When
      const deuxiemePlan = unPlan({
        id: 'plan-2',
        objectives: [
          {
            ...premierPlan.objectives[0],
            id: 'objectif-2',
            actions: [premierPlan.objectives[0].actions[0]]
          }
        ]
      })
      await planActionSqlRepository.save('ABCDE', deuxiemePlan)

      // Then
      const referentiel = await ReferentielPlanActionTacheSqlModel.findAll()
      expect(referentiel).to.have.length(2)
      const taches = await PlanActionTacheSqlModel.findAll()
      expect(taches).to.have.length(3)
    })
  })

  describe('.getDernierPlan(idJeune)', () => {
    it("renvoie undefined quand le jeune n'a pas de plan", async () => {
      // When
      const actual = await planActionSqlRepository.getDernierPlan('ABCDE')

      // Then
      expect(actual).to.equal(undefined)
    })

    it('renvoie le plan le plus récent', async () => {
      // Given
      idService.uuid
        .onCall(0)
        .returns('11111111-1111-1111-1111-111111111111')
        .onCall(1)
        .returns('22222222-2222-2222-2222-222222222222')
        .onCall(2)
        .returns('33333333-3333-3333-3333-333333333333')
        .onCall(3)
        .returns('44444444-4444-4444-4444-444444444444')
      dateService.now.returns(DateTime.fromISO('2026-01-01T00:00:00.000Z'))
      await planActionSqlRepository.save('ABCDE', unPlan({ id: 'plan-1' }))
      dateService.now.returns(DateTime.fromISO('2026-02-01T00:00:00.000Z'))
      await planActionSqlRepository.save(
        'ABCDE',
        unPlan({
          id: 'plan-2',
          objectives: [{ ...unPlan().objectives[0], id: 'objectif-2' }]
        })
      )

      // When
      const actual = await planActionSqlRepository.getDernierPlan('ABCDE')

      // Then
      expect(actual?.id).to.equal('plan-2')
    })
  })
})

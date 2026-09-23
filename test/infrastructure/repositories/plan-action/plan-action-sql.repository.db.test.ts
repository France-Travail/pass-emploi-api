import { PlanAction } from 'src/domain/plan-action/plan-action'
import { FirebaseClient } from 'src/infrastructure/clients/firebase-client'
import { ConseillerSqlRepository } from 'src/infrastructure/repositories/conseiller-sql.repository.db'
import { JeuneSqlRepository } from 'src/infrastructure/repositories/jeune/jeune-sql.repository.db'
import { PlanActionSqlRepository } from 'src/infrastructure/repositories/plan-action/plan-action-sql.repository.db'
import { PlanActionSqlModel } from 'src/infrastructure/sequelize/models/plan-action.sql-model'
import { PlanActionTacheSqlModel } from 'src/infrastructure/sequelize/models/plan-action-tache.sql-model'
import { ReferentielPlanActionSolutionSqlModel } from 'src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { unConseiller } from 'test/fixtures/conseiller.fixture'
import { unJeune } from 'test/fixtures/jeune.fixture'
import { expect, stubClass } from 'test/utils'
import {
  DatabaseForTesting,
  getDatabase
} from 'test/utils/database-for-testing'

const maintenant = uneDatetime()

describe('PlanActionSqlRepository', () => {
  let database: DatabaseForTesting
  before(async () => {
    database = getDatabase()
  })

  let planActionSqlRepository: PlanActionSqlRepository

  async function insererSolution(id: string): Promise<void> {
    await ReferentielPlanActionSolutionSqlModel.create({
      id,
      type: 'LIEN',
      libelle: 'Je consulte des sites',
      situations: [],
      authentifications: [],
      territoires: [],
      active: true,
      dateMaj: maintenant.toJSDate()
    })
  }

  function unPlan(override: Partial<PlanAction> = {}): PlanAction {
    return {
      id: 'plan-1',
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'objectif-1',
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          taches: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              idSolution: 'p-2',
              terminee: false,
              dateCreation: maintenant
            }
          ]
        }
      ],
      ...override
    }
  }

  beforeEach(async () => {
    await database.cleanPG()
    const idService = stubClass(IdService)
    const dateService = stubClass(DateService)

    planActionSqlRepository = new PlanActionSqlRepository(database.sequelize)

    const conseillerRepository = new ConseillerSqlRepository()
    await conseillerRepository.save(unConseiller())
    const firebaseClient = stubClass(FirebaseClient)
    const jeuneRepository = new JeuneSqlRepository(
      database.sequelize,
      firebaseClient,
      idService,
      dateService
    )
    await jeuneRepository.save(unJeune({ id: 'jeune-1' }))
  })

  describe('save', () => {
    it('persiste le plan, ses objectifs et ses tâches', async () => {
      // Given
      await insererSolution('p-2')

      // When
      await planActionSqlRepository.save(unPlan())

      // Then
      const planSql = await PlanActionSqlModel.findByPk('plan-1')
      expect(planSql!.idJeune).to.equal('jeune-1')
      const tacheSql = await PlanActionTacheSqlModel.findByPk(
        '11111111-1111-1111-1111-111111111111'
      )
      expect(tacheSql!.idSolution).to.equal('p-2')
      expect(tacheSql!.terminee).to.equal(false)
    })

    it("n'écrit rien dans le référentiel", async () => {
      // Given
      await insererSolution('p-2')

      // When
      await planActionSqlRepository.save(unPlan())

      // Then
      const nbSolutions = await ReferentielPlanActionSolutionSqlModel.count()
      expect(nbSolutions).to.equal(1)
    })
  })

  describe('getDernierPlan', () => {
    it('rend le plan le plus récent du jeune', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      await planActionSqlRepository.save(
        unPlan({
          id: 'plan-2',
          dateCreation: maintenant.plus({ days: 1 }),
          objectifs: [
            {
              id: 'objectif-2',
              titre: 'Objectif récent',
              theme: 'employment',
              taches: [
                {
                  id: '22222222-2222-2222-2222-222222222222',
                  idSolution: 'p-2',
                  terminee: false,
                  dateCreation: maintenant.plus({ days: 1 })
                }
              ]
            }
          ]
        })
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.id).to.equal('plan-2')
      expect(plan!.objectifs[0].titre).to.equal('Objectif récent')
    })

    it('rend le plan avec ses identifiants de solution', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.objectifs[0].taches[0]).to.deep.equal({
        id: '11111111-1111-1111-1111-111111111111',
        idSolution: 'p-2',
        terminee: false,
        dateCreation: maintenant
      })
    })

    it("rend undefined quand le jeune n'a pas de plan", async () => {
      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan).to.equal(undefined)
    })

    it('persiste et rend, dans le même ordre, plusieurs objectifs dont un porte plusieurs tâches', async () => {
      // Given
      await insererSolution('p-2')
      await insererSolution('p-3')
      const plan = unPlan({
        objectifs: [
          {
            id: 'objectif-1',
            titre: 'Trouver une alternance',
            theme: 'apprenticeship',
            taches: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                idSolution: 'p-2',
                terminee: false,
                dateCreation: maintenant
              },
              {
                id: '22222222-2222-2222-2222-222222222222',
                idSolution: 'p-3',
                terminee: false,
                dateCreation: maintenant.plus({ minutes: 1 })
              }
            ]
          },
          {
            id: 'objectif-2',
            titre: 'Se former',
            theme: 'training',
            taches: [
              {
                id: '33333333-3333-3333-3333-333333333333',
                idSolution: 'p-2',
                terminee: false,
                dateCreation: maintenant
              }
            ]
          }
        ]
      })
      await planActionSqlRepository.save(plan)

      // When
      const planRendu = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(planRendu!.objectifs).to.have.length(2)
      expect(planRendu!.objectifs.map(objectif => objectif.id)).to.deep.equal([
        'objectif-1',
        'objectif-2'
      ])
      expect(planRendu!.objectifs[0].taches).to.have.length(2)
      expect(
        planRendu!.objectifs[0].taches.map(tache => tache.id)
      ).to.deep.equal([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      ])
      expect(planRendu!.objectifs[1].taches).to.have.length(1)
    })
  })
})

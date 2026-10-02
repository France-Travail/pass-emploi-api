import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
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
      id: '11111111-1111-4111-8111-111111111111',
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
          titre: 'Trouver une alternance',
          theme: Questionnaire.Besoin.ALTERNANCE,
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
      const planSql = await PlanActionSqlModel.findByPk(
        '11111111-1111-4111-8111-111111111111'
      )
      expect(planSql!.idJeune).to.equal('jeune-1')
      const tacheSql = await PlanActionTacheSqlModel.findByPk(
        '11111111-1111-1111-1111-111111111111'
      )
      expect(tacheSql!.idSolution).to.equal('p-2')
      expect(tacheSql!.terminee).to.equal(false)
    })

    it("persiste la date de suppression d'une tâche reprise d'un plan précédent", async () => {
      // Given
      await insererSolution('p-2')
      const dateSuppression = maintenant.minus({ days: 1 })
      const plan = unPlan()
      plan.objectifs[0].taches[0] = {
        ...plan.objectifs[0].taches[0],
        dateSuppression
      }

      // When
      await planActionSqlRepository.save(plan)

      // Then
      const tacheSql = await PlanActionTacheSqlModel.findByPk(
        '11111111-1111-1111-1111-111111111111'
      )
      expect(tacheSql!.dateSuppression).to.deep.equal(
        dateSuppression.toJSDate()
      )
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
          id: '22222222-2222-4222-8222-222222222222',
          dateCreation: maintenant.plus({ days: 1 }),
          objectifs: [
            {
              id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
              titre: 'Objectif récent',
              theme: Questionnaire.Besoin.EMPLOI,
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
      expect(plan!.id).to.equal('22222222-2222-4222-8222-222222222222')
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

    it('rend les tâches supprimées avec leur date de suppression', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      const dateSuppression = maintenant.plus({ days: 1 })
      await planActionSqlRepository.supprimerTache(
        '11111111-1111-1111-1111-111111111111',
        dateSuppression
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.objectifs[0].taches[0]).to.deep.equal({
        id: '11111111-1111-1111-1111-111111111111',
        idSolution: 'p-2',
        terminee: false,
        dateCreation: maintenant,
        dateSuppression
      })
    })

    it("rend undefined quand le jeune n'a pas de plan", async () => {
      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan).to.equal(undefined)
    })

    it("rend les objectifs et les tâches dans l'ordre du plan sauvegardé, pas dans celui des identifiants ni des dates", async () => {
      // Given
      await insererSolution('p-2')
      await insererSolution('p-3')
      await insererSolution('p-4')
      const plan = unPlan({
        objectifs: [
          {
            id: 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
            titre: 'Se former',
            theme: Questionnaire.Besoin.FORMER,
            taches: [
              {
                id: '33333333-3333-3333-3333-333333333333',
                idSolution: 'p-2',
                terminee: false,
                dateCreation: maintenant
              }
            ]
          },
          {
            id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
            titre: 'Trouver une alternance',
            theme: Questionnaire.Besoin.ALTERNANCE,
            taches: [
              // Nouvelle tâche, placée avant une tâche reprise d'un plan précédent
              {
                id: '22222222-2222-2222-2222-222222222222',
                idSolution: 'p-3',
                terminee: false,
                dateCreation: maintenant
              },
              {
                id: '11111111-1111-1111-1111-111111111111',
                idSolution: 'p-2',
                terminee: true,
                dateCreation: maintenant.minus({ days: 10 })
              },
              {
                id: '00000000-0000-4000-8000-000000000000',
                idSolution: 'p-4',
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
      expect(planRendu!.objectifs.map(objectif => objectif.id)).to.deep.equal([
        'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
        'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
      ])
      expect(
        planRendu!.objectifs[1].taches.map(tache => tache.id)
      ).to.deep.equal([
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        '00000000-0000-4000-8000-000000000000'
      ])
    })

    it("retombe sur l'ancien tri pour un plan stocké avant la colonne ordre", async () => {
      // Given
      await insererSolution('p-2')
      await insererSolution('p-3')
      await planActionSqlRepository.save(
        unPlan({
          objectifs: [
            {
              id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
              titre: 'Trouver une alternance',
              theme: Questionnaire.Besoin.ALTERNANCE,
              taches: [
                {
                  id: '22222222-2222-2222-2222-222222222222',
                  idSolution: 'p-3',
                  terminee: false,
                  dateCreation: maintenant.plus({ minutes: 1 })
                },
                {
                  id: '11111111-1111-1111-1111-111111111111',
                  idSolution: 'p-2',
                  terminee: false,
                  dateCreation: maintenant
                }
              ]
            }
          ]
        })
      )
      await PlanActionTacheSqlModel.update({ ordre: null }, { where: {} })

      // When
      const planRendu = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(
        planRendu!.objectifs[0].taches.map(tache => tache.id)
      ).to.deep.equal([
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      ])
    })
  })

  describe('getTache', () => {
    const idTache = '11111111-1111-1111-1111-111111111111'

    it('rend la tâche quand elle appartient au plan du jeune', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())

      // When
      const tache = await planActionSqlRepository.getTache('jeune-1', idTache)

      // Then
      expect(tache).to.deep.equal({
        id: idTache,
        idSolution: 'p-2',
        terminee: false,
        dateCreation: maintenant
      })
    })

    it('rend undefined quand la tâche est supprimée', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      await planActionSqlRepository.supprimerTache(idTache, maintenant)

      // When
      const tache = await planActionSqlRepository.getTache('jeune-1', idTache)

      // Then
      expect(tache).to.equal(undefined)
    })

    it("rend undefined quand la tâche appartient au plan d'un autre jeune", async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())

      // When
      const tache = await planActionSqlRepository.getTache('jeune-2', idTache)

      // Then
      expect(tache).to.equal(undefined)
    })
  })

  describe('saveTache', () => {
    const idTache = '11111111-1111-1111-1111-111111111111'

    it('met à jour le statut et la date de complétion', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      const dateTerminee = maintenant.plus({ days: 1 })

      // When
      await planActionSqlRepository.saveTache({
        id: idTache,
        idSolution: 'p-2',
        terminee: true,
        dateCreation: maintenant,
        dateTerminee
      })

      // Then
      const tache = await planActionSqlRepository.getTache('jeune-1', idTache)
      expect(tache).to.deep.equal({
        id: idTache,
        idSolution: 'p-2',
        terminee: true,
        dateCreation: maintenant,
        dateTerminee
      })
    })

    it('efface la date de complétion quand la tâche est décochée', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      await planActionSqlRepository.saveTache({
        id: idTache,
        idSolution: 'p-2',
        terminee: true,
        dateCreation: maintenant,
        dateTerminee: maintenant
      })

      // When
      await planActionSqlRepository.saveTache({
        id: idTache,
        idSolution: 'p-2',
        terminee: false,
        dateCreation: maintenant
      })

      // Then
      const tacheSql = await PlanActionTacheSqlModel.findByPk(idTache)
      expect(tacheSql!.terminee).to.equal(false)
      expect(tacheSql!.dateTerminee).to.equal(null)
    })
  })

  describe('supprimerTache', () => {
    it('conserve la tâche en la datant comme supprimée', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      const dateSuppression = maintenant.plus({ days: 1 })

      // When
      await planActionSqlRepository.supprimerTache(
        '11111111-1111-1111-1111-111111111111',
        dateSuppression
      )

      // Then
      const tacheSql = await PlanActionTacheSqlModel.findByPk(
        '11111111-1111-1111-1111-111111111111'
      )
      expect(tacheSql!.dateSuppression).to.deep.equal(
        dateSuppression.toJSDate()
      )
    })
  })
})

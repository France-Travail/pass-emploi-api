import { DateTime } from 'luxon'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
import { Profil } from 'src/domain/profil'
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

  function unQuestionnaire(
    override: Partial<Questionnaire> = {}
  ): Questionnaire {
    return {
      structure: Profil.Structure.MILO,
      situation: Questionnaire.Situation.LYCEE,
      besoins: [Questionnaire.Besoin.ALTERNANCE, Questionnaire.Besoin.EMPLOI],
      contraintes: [Questionnaire.Contrainte.SANTE],
      ...override
    }
  }

  beforeEach(async () => {
    await database.cleanPG()
    const idService = stubClass(IdService)
    const dateService = stubClass(DateService)

    planActionSqlRepository = new PlanActionSqlRepository()

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
  })

  describe('questionnaire', () => {
    beforeEach(async () => {
      await insererSolution('p-2')
    })

    it('relit toutes les réponses du questionnaire sauvegardé avec le plan', async () => {
      // Given
      await planActionSqlRepository.save(
        unPlan({
          questionnaire: unQuestionnaire({
            dateNaissance: DateTime.fromISO('2008-03-15T00:00:00.000+02:00', {
              setZone: true
            }),
            communeResidence: { codeInsee: '75056', nom: 'Paris' },
            communeRecherche: { codeInsee: '2A004', nom: 'Ajaccio' },
            domaineProfessionnelVise: 'informatique',
            rayonKm: 30
          })
        })
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.questionnaire!.dateNaissance!.toISODate()).to.equal(
        '2008-03-15'
      )
      const { dateNaissance: _dateNaissance, ...reste } = plan!.questionnaire!
      expect(reste).to.deep.equal({
        structure: Profil.Structure.MILO,
        situation: Questionnaire.Situation.LYCEE,
        besoins: [Questionnaire.Besoin.ALTERNANCE, Questionnaire.Besoin.EMPLOI],
        contraintes: [Questionnaire.Contrainte.SANTE],
        communeResidence: { codeInsee: '75056', nom: 'Paris' },
        communeRecherche: { codeInsee: '2A004', nom: 'Ajaccio' },
        domaineProfessionnelVise: 'informatique',
        rayonKm: 30
      })
    })

    it('sauvegarde à null les réponses optionnelles absentes', async () => {
      // When
      await planActionSqlRepository.save(
        unPlan({ questionnaire: unQuestionnaire() })
      )

      // Then
      const planSql = await PlanActionSqlModel.findByPk(unPlan().id)
      expect(planSql!.dateNaissance).to.be.null()
      expect(planSql!.codeInseeCommuneResidence).to.be.null()
      expect(planSql!.nomCommuneResidence).to.be.null()
      expect(planSql!.codeInseeCommuneRecherche).to.be.null()
      expect(planSql!.nomCommuneRecherche).to.be.null()
      expect(planSql!.domaineProfessionnelVise).to.be.null()
      expect(planSql!.rayonKm).to.be.null()
    })

    it("n'invente pas les réponses optionnelles absentes", async () => {
      // Given
      await planActionSqlRepository.save(
        unPlan({ questionnaire: unQuestionnaire() })
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.questionnaire).not.to.have.any.keys(
        'dateNaissance',
        'communeResidence',
        'communeRecherche',
        'domaineProfessionnelVise',
        'rayonKm'
      )
    })

    it('rend le questionnaire du plan le plus récent', async () => {
      // Given
      await planActionSqlRepository.save(
        unPlan({
          id: '22222222-2222-4222-8222-222222222222',
          dateCreation: maintenant.minus({ days: 1 }),
          objectifs: [],
          questionnaire: unQuestionnaire({
            besoins: [Questionnaire.Besoin.FORMER]
          })
        })
      )
      await planActionSqlRepository.save(
        unPlan({ questionnaire: unQuestionnaire() })
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.questionnaire!.besoins).to.deep.equal([
        Questionnaire.Besoin.ALTERNANCE,
        Questionnaire.Besoin.EMPLOI
      ])
    })

    it('rend un plan sans questionnaire quand il a été généré avant sa sauvegarde', async () => {
      // Given
      await planActionSqlRepository.save(unPlan())

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan).not.to.have.property('questionnaire')
    })
  })

  describe('getQuestionnaireDuDernierPlan', () => {
    beforeEach(async () => {
      await insererSolution('p-2')
    })

    it('rend le questionnaire du plan le plus récent', async () => {
      // Given
      await planActionSqlRepository.save(
        unPlan({
          id: '22222222-2222-4222-8222-222222222222',
          dateCreation: maintenant.minus({ days: 1 }),
          objectifs: [],
          questionnaire: unQuestionnaire({
            besoins: [Questionnaire.Besoin.FORMER]
          })
        })
      )
      await planActionSqlRepository.save(
        unPlan({
          questionnaire: unQuestionnaire({
            communeResidence: { codeInsee: '75056', nom: 'Paris' }
          })
        })
      )

      // When
      const questionnaire =
        await planActionSqlRepository.getQuestionnaireDuDernierPlan('jeune-1')

      // Then
      expect(questionnaire).to.deep.equal(
        unQuestionnaire({
          communeResidence: { codeInsee: '75056', nom: 'Paris' }
        })
      )
    })

    it('rend undefined quand le dernier plan a été généré sans questionnaire', async () => {
      // Given
      await planActionSqlRepository.save(unPlan())

      // When
      const questionnaire =
        await planActionSqlRepository.getQuestionnaireDuDernierPlan('jeune-1')

      // Then
      expect(questionnaire).to.be.undefined()
    })

    it("rend undefined quand le jeune n'a pas de plan", async () => {
      // When
      const questionnaire =
        await planActionSqlRepository.getQuestionnaireDuDernierPlan('jeune-1')

      // Then
      expect(questionnaire).to.be.undefined()
    })
  })

  describe('contrainte questionnaire complet', () => {
    it('refuse un plan dont le questionnaire est partiellement renseigné', async () => {
      // When
      const promesse = PlanActionSqlModel.create({
        id: unPlan().id,
        idJeune: 'jeune-1',
        dateCreation: maintenant.toJSDate(),
        dateMaj: maintenant.toJSDate(),
        situation: Questionnaire.Situation.LYCEE
      })

      // Then
      await expect(promesse).to.be.rejectedWith(
        'plan_action_questionnaire_complet'
      )
    })
  })

  describe('existePourJeune', () => {
    it('rend true quand le jeune a un plan', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())

      // When
      const existe = await planActionSqlRepository.existePourJeune('jeune-1')

      // Then
      expect(existe).to.equal(true)
    })

    it("rend false quand le jeune n'a pas de plan", async () => {
      // When
      const existe = await planActionSqlRepository.existePourJeune('jeune-1')

      // Then
      expect(existe).to.equal(false)
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

    it('rend undefined quand la tâche appartient à un plan précédent', async () => {
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
              titre: 'Trouver une alternance',
              theme: Questionnaire.Besoin.ALTERNANCE,
              taches: [
                {
                  id: '33333333-3333-3333-3333-333333333333',
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

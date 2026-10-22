import { DateTime } from 'luxon'
import { Profil } from 'src/domain/profil'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
import { FirebaseClient } from 'src/infrastructure/clients/firebase-client'
import { ConseillerSqlRepository } from 'src/infrastructure/repositories/conseiller-sql.repository.db'
import { JeuneSqlRepository } from 'src/infrastructure/repositories/jeune/jeune-sql.repository.db'
import { QuestionnaireSqlRepository } from 'src/infrastructure/repositories/plan-action/questionnaire-sql.repository.db'
import { QuestionnaireSqlModel } from 'src/infrastructure/sequelize/models/questionnaire.sql-model'
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

describe('QuestionnaireSqlRepository', () => {
  let database: DatabaseForTesting
  before(async () => {
    database = getDatabase()
  })

  let questionnaireSqlRepository: QuestionnaireSqlRepository

  function unQuestionnaire(
    override: Partial<Questionnaire.Enregistre> = {}
  ): Questionnaire.Enregistre {
    return {
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      structure: Profil.Structure.MILO,
      situation: Questionnaire.Situation.LYCEE,
      besoins: [Questionnaire.Besoin.ALTERNANCE, Questionnaire.Besoin.EMPLOI],
      contraintes: [Questionnaire.Contrainte.SANTE],
      ...override
    }
  }

  beforeEach(async () => {
    await database.cleanPG()
    questionnaireSqlRepository = new QuestionnaireSqlRepository()

    const conseillerRepository = new ConseillerSqlRepository()
    await conseillerRepository.save(unConseiller())
    const jeuneRepository = new JeuneSqlRepository(
      database.sequelize,
      stubClass(FirebaseClient),
      stubClass(IdService),
      stubClass(DateService)
    )
    await jeuneRepository.save(unJeune({ id: 'jeune-1' }))
  })

  describe('save et get', () => {
    it('relit toutes les réponses du questionnaire sauvegardé', async () => {
      // Given
      await questionnaireSqlRepository.save(
        unQuestionnaire({
          dateNaissance: DateTime.fromISO('2008-03-15T00:00:00.000+02:00', {
            setZone: true
          }),
          communeResidence: { codeInsee: '75056', nom: 'Paris' },
          communeRecherche: { codeInsee: '2A004', nom: 'Ajaccio' },
          domaineProfessionnelVise: 'informatique',
          rayonKm: 30
        })
      )

      // When
      const questionnaire = await questionnaireSqlRepository.get('jeune-1')

      // Then
      expect(questionnaire!.dateCreation.toMillis()).to.equal(
        maintenant.toMillis()
      )
      expect(questionnaire!.dateNaissance!.toISODate()).to.equal('2008-03-15')
      const {
        dateCreation: _dateCreation,
        dateNaissance: _dateNaissance,
        ...reste
      } = questionnaire!
      expect(reste).to.deep.equal({
        idJeune: 'jeune-1',
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
      await questionnaireSqlRepository.save(unQuestionnaire())

      // Then
      const questionnaireSql = await QuestionnaireSqlModel.findByPk('jeune-1')
      expect(questionnaireSql!.dateNaissance).to.be.null()
      expect(questionnaireSql!.codeInseeCommuneResidence).to.be.null()
      expect(questionnaireSql!.nomCommuneResidence).to.be.null()
      expect(questionnaireSql!.codeInseeCommuneRecherche).to.be.null()
      expect(questionnaireSql!.nomCommuneRecherche).to.be.null()
      expect(questionnaireSql!.domaineProfessionnelVise).to.be.null()
      expect(questionnaireSql!.rayonKm).to.be.null()
    })

    it("n'invente pas les réponses optionnelles absentes", async () => {
      // Given
      await questionnaireSqlRepository.save(unQuestionnaire())

      // When
      const questionnaire = await questionnaireSqlRepository.get('jeune-1')

      // Then
      expect(questionnaire).not.to.have.any.keys(
        'dateNaissance',
        'communeResidence',
        'communeRecherche',
        'domaineProfessionnelVise',
        'rayonKm'
      )
    })

    it('remplace le questionnaire existant du jeune et met à jour sa date', async () => {
      // Given
      await questionnaireSqlRepository.save(
        unQuestionnaire({
          dateCreation: maintenant.minus({ days: 1 }),
          communeResidence: { codeInsee: '75056', nom: 'Paris' },
          domaineProfessionnelVise: 'informatique',
          rayonKm: 30
        })
      )

      // When
      await questionnaireSqlRepository.save(
        unQuestionnaire({ besoins: [Questionnaire.Besoin.FORMER] })
      )

      // Then
      expect(await QuestionnaireSqlModel.count()).to.equal(1)
      const questionnaire = await questionnaireSqlRepository.get('jeune-1')
      expect(questionnaire!.besoins).to.deep.equal([
        Questionnaire.Besoin.FORMER
      ])
      expect(questionnaire!.dateCreation.toMillis()).to.equal(
        maintenant.toMillis()
      )
      expect(questionnaire).not.to.have.any.keys(
        'communeResidence',
        'domaineProfessionnelVise',
        'rayonKm'
      )
    })

    it("renvoie undefined quand le jeune n'a pas de questionnaire", async () => {
      // When
      const questionnaire = await questionnaireSqlRepository.get('jeune-1')

      // Then
      expect(questionnaire).to.be.undefined()
    })
  })
})

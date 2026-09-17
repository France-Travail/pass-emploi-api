import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { expect } from 'chai'
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
import { createSandbox, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

const maintenant = uneDatetime()
const hier = maintenant.minus({ days: 1 }).toJSDate()
const demain = maintenant.plus({ days: 1 }).toJSDate()

describe('NotifierCommunicationsJobHandler', () => {
  let handler: NotifierCommunicationsJobHandler
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let sandbox: SinonSandbox

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
    planificateurRepository.recupererPremierJobNonTermine.resolves(null)

    handler = new NotifierCommunicationsJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository
    )
  })

  afterEach(() => {
    sandbox.reset()
  })

  function uneCommunicationNotification(
    surcharge: Partial<{
      dateDebut: Date
      envoyeeLe: Date | null
      type: Communication.Type
      typeNotification: Notification.Type | null
      push: boolean
    }>
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
      envoyeeLe: null,
      ...surcharge
    })
  }

  describe('handle', () => {
    it('enfile NOTIFIER_BENEFICIAIRES pour une communication due et marque envoyeeLe', async () => {
      // Given
      const communication = await uneCommunicationNotification({})

      // When
      const suiviJob = await handler.handle()

      // Then
      expect(
        planificateurRepository.ajouterJob
      ).to.have.been.calledOnceWithExactly({
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
        contenu: {
          typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
          titre: 'Courte',
          description: 'Court',
          params: {
            idPopulation: 'PHASE_C',
            push: true,
            minutesEntreLesBatchs: 5
          }
        }
      })
      const communicationMiseAJour = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationMiseAJour!.envoyeeLe).to.deep.equal(
        maintenant.toJSDate()
      )
      expect(suiviJob.succes).to.equal(true)
      expect(suiviJob.resultat).to.deep.equal({
        nbCommunicationsEnfilees: 1,
        idsCommunicationsEnfilees: [communication.id],
        bloqueParUnJobEnCours: false
      })
    })

    it("enfile un typeNotification CENTRE_DE_NOTIFS_UNIQUEMENT quand la communication n'en a pas : l'app ne redirige nulle part", async () => {
      // Given
      await uneCommunicationNotification({ typeNotification: null })

      // When
      await handler.handle()

      // Then
      expect(
        planificateurRepository.ajouterJob
      ).to.have.been.calledOnceWithExactly({
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
        contenu: {
          typeNotification: Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT,
          titre: 'Courte',
          description: 'Court',
          params: {
            idPopulation: 'PHASE_C',
            push: true,
            minutesEntreLesBatchs: 5
          }
        }
      })
    })

    it('transmet push tel quel, y compris à false', async () => {
      // Given
      await uneCommunicationNotification({ push: false })

      // When
      await handler.handle()

      // Then
      expect(
        planificateurRepository.ajouterJob
      ).to.have.been.calledOnceWithExactly({
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
        contenu: {
          typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
          titre: 'Courte',
          description: 'Court',
          params: {
            idPopulation: 'PHASE_C',
            push: false,
            minutesEntreLesBatchs: 5
          }
        }
      })
    })

    it('ignore une communication déjà envoyée', async () => {
      // Given
      await uneCommunicationNotification({ envoyeeLe: hier })

      // When
      await handler.handle()

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it('ignore une communication dont la date de début est future', async () => {
      // Given
      await uneCommunicationNotification({ dateDebut: demain })

      // When
      await handler.handle()

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it("envoie une communication en retard, sans notion de péremption (dateFin n'existe pas pour NOTIFICATION)", async () => {
      // Given
      const bienEnRetard = maintenant.minus({ days: 10 }).toJSDate()
      const communication = await uneCommunicationNotification({
        dateDebut: bienEnRetard
      })

      // When
      await handler.handle()

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
      const communicationMiseAJour = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationMiseAJour!.envoyeeLe).to.deep.equal(
        maintenant.toJSDate()
      )
    })

    it('ignore une communication IN_APP', async () => {
      // Given
      await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.IN_APP,
        dateDebut: hier,
        dateFin: demain,
        titre: 'Bandeau',
        contenu: 'Contenu'
      })

      // When
      await handler.handle()

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it("n'enfile rien et laisse envoyeeLe à null quand un job NOTIFIER_BENEFICIAIRES est déjà en cours", async () => {
      // Given
      const communication = await uneCommunicationNotification({})
      planificateurRepository.recupererPremierJobNonTermine.resolves('job-1')

      // When
      const suiviJob = await handler.handle()

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
      const communicationInchangee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationInchangee!.envoyeeLe).to.be.null()
      expect(suiviJob.resultat).to.deep.equal({
        nbCommunicationsEnfilees: 0,
        idsCommunicationsEnfilees: [],
        bloqueParUnJobEnCours: true
      })
    })
  })
})

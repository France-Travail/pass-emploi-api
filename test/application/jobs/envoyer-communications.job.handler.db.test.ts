import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { expect } from 'chai'
import { SinonSandbox } from 'sinon'
import { EnvoyerCommunicationsJobHandler } from '../../../src/application/jobs/envoyer-communications.job.handler.db'
import { Communication } from '../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../src/domain/communication-envoi'
import { Core } from '../../../src/domain/core'
import { Notification } from '../../../src/domain/notification/notification'
import { Profil } from '../../../src/domain/profil'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationEnvoiSqlModel } from '../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { rootLogger } from '../../../src/utils/logger.module'
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
  let communicationRepository: CommunicationSqlRepository
  let sandbox: SinonSandbox

  beforeEach(async () => {
    await getDatabase().cleanPG()
    sandbox = createSandbox()
    sandbox.stub(rootLogger, 'info')
    sandbox.stub(rootLogger, 'error')
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    notificationRepository = stubInterface(sandbox)
    notificationRepository.send.resolves(Notification.ResultatEnvoi.ENVOYEE)
    communicationRepository = new CommunicationSqlRepository(
      getDatabase().sequelize
    )

    await ConseillerSqlModel.create(
      unConseillerDto({
        id: 'conseiller',
        structure: Core.Structure.POLE_EMPLOI
      })
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
      communicationRepository,
      notificationRepository,
      testConfig()
    )
  })

  afterEach(() => sandbox.restore())

  function uneNotification(
    surcharge: Partial<{
      statutEnvoi: Communication.StatutEnvoi
      push: boolean
      echecsConsecutifs: number
    }> = {}
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
    await CommunicationSqlModel.update(
      { typeNotification: null },
      { where: {} }
    )
    await handler.handle()

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send.firstCall.args[0].data.type).to.equal(
      Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
    )
    expect(notificationRepository.send.firstCall.args[2]).to.equal(false)
  })

  it('marque TOKEN_INVALIDE sans appeler Firebase pour un jeune dont le token a disparu depuis le figement', async () => {
    // Given
    await uneNotification()
    await handler.handle()
    await JeuneSqlModel.update(
      { pushNotificationToken: null },
      { where: { id: 'jeune2' } }
    )

    // When
    await handler.handle()

    // Then
    expect(notificationRepository.send).to.have.been.calledTwice()
    const envoi = await CommunicationEnvoiSqlModel.findOne({
      where: { idJeune: 'jeune2' }
    })
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
    expect(
      (await communicationRepository.compterEnvois(communication.id)).aEnvoyer
    ).to.equal(3)
    const enErreur = (await CommunicationSqlModel.findByPk(communication.id))!
    expect(enErreur.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_ERREUR)
    expect(enErreur.echecsConsecutifs).to.equal(3)
  })

  it('marque en erreur les jeunes en échec et remet les échecs à zéro quand le lot est partiellement en erreur', async () => {
    // Given
    const communication = await uneNotification({ echecsConsecutifs: 1 })
    await handler.handle()
    notificationRepository.send
      .onSecondCall()
      .resolves(Notification.ResultatEnvoi.ERREUR)

    // When
    const suivi = await handler.handle()

    // Then
    const envois = await CommunicationEnvoiSqlModel.findAll({
      order: [['idJeune', 'ASC']]
    })
    expect(envois.map(e => e.statut)).to.deep.equal([
      CommunicationEnvoi.Statut.ENVOYEE,
      CommunicationEnvoi.Statut.ERREUR,
      CommunicationEnvoi.Statut.ENVOYEE
    ])
    const enCours = (await CommunicationSqlModel.findByPk(communication.id))!
    expect(enCours.statutEnvoi).to.equal(Communication.StatutEnvoi.EN_COURS)
    expect(enCours.echecsConsecutifs).to.equal(0)
    expect(suivi.succes).to.equal(true)
    expect(suivi.nbErreurs).to.equal(1)
    expect((suivi.resultat as { erreurs: number }).erreurs).to.equal(1)
  })

  it("ne fait rien tant qu'il reste des envois en cours et rien à réserver", async () => {
    // Given
    const communication = await uneNotification({
      statutEnvoi: Communication.StatutEnvoi.EN_COURS
    })
    await CommunicationEnvoiSqlModel.create({
      idCommunication: communication.id,
      idJeune: 'jeune1',
      statut: CommunicationEnvoi.Statut.EN_COURS,
      dateTraitement: maintenant.minus({ minutes: 5 }).toJSDate()
    })

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.silencieux).to.equal(true)
    expect(notificationRepository.send).not.to.have.been.called()
    expect(
      (await CommunicationSqlModel.findByPk(communication.id))!.statutEnvoi
    ).to.equal(Communication.StatutEnvoi.EN_COURS)
  })

  it('libère les envois bloqués depuis plus de 30 minutes avant de réserver', async () => {
    // Given
    const communication = await uneNotification({
      statutEnvoi: Communication.StatutEnvoi.EN_COURS
    })
    await CommunicationEnvoiSqlModel.bulkCreate([
      {
        idCommunication: communication.id,
        idJeune: 'jeune1',
        statut: CommunicationEnvoi.Statut.EN_COURS,
        dateTraitement: maintenant.minus({ minutes: 31 }).toJSDate()
      },
      {
        idCommunication: communication.id,
        idJeune: 'jeune2',
        statut: CommunicationEnvoi.Statut.EN_COURS,
        dateTraitement: maintenant.minus({ minutes: 5 }).toJSDate()
      }
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
    const config = new ConfigService({
      jobs: { envoiCommunications: { actif: false, tailleLot: '300' } }
    })
    handler = new EnvoyerCommunicationsJobHandler(
      suiviJobService,
      dateService,
      communicationRepository,
      notificationRepository,
      config
    )

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.silencieux).to.equal(true)
    expect(await CommunicationEnvoiSqlModel.count()).to.equal(0)
  })
})

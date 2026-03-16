import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { expect } from 'chai'
import { SinonSandbox } from 'sinon'
import { NotifierNouvelleActualiteMiloJobHandler } from 'src/application/jobs/notifier-nouvelle-actualite-milo.job.handler.db'
import { Notification } from 'src/domain/notification/notification'
import { Planificateur } from 'src/domain/planificateur'
import { SuiviJob } from 'src/domain/suivi-job'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from 'src/infrastructure/sequelize/models/jeune.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import {
  unJeuneDto,
  unJeuneMiloDto
} from '../../fixtures/sql-models/jeune.sql-model'
import { createSandbox, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

const idStructureMilo = 'structure-1'
const idActualite = 'actualite-1'
const maintenant = uneDatetime()

describe('NotifierNouvelleActualiteMiloJobHandler', () => {
  let handler: NotifierNouvelleActualiteMiloJobHandler
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let notificationRepository: StubbedType<Notification.Repository>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let sandbox: SinonSandbox

  before(async () => {
    const databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()

    sandbox = createSandbox()
    notificationRepository = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())
    suiviJobService = stubInterface(sandbox)

    handler = new NotifierNouvelleActualiteMiloJobHandler(
      notificationRepository,
      suiviJobService,
      dateService,
      planificateurRepository
    )

    await ConseillerSqlModel.create(unConseillerDto({ id: 'conseiller-1' }))
  })

  after(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    beforeEach(async () => {
      await JeuneSqlModel.destroy({ where: {} })
      sandbox.reset()
      dateService.now.returns(maintenant)
      dateService.nowJs.returns(maintenant.toJSDate())
    })

    it('envoie une notification à chaque jeune de la structure avec un token', async () => {
      // Given
      await JeuneSqlModel.bulkCreate([
        unJeuneMiloDto(
          unJeuneDto({ id: 'j1', pushNotificationToken: 'token-j1' }),
          idStructureMilo
        ),
        unJeuneMiloDto(
          unJeuneDto({ id: 'j2', pushNotificationToken: 'token-j2' }),
          idStructureMilo
        )
      ])

      const job = unJob({ idStructureMilo, idActualite })

      // When
      const result = await handler.handle(job)

      // Then
      expect(notificationRepository.send).to.have.been.calledTwice()
      expect(result.succes).to.be.true()
      expect(result.resultat).to.deep.equal({
        nbEnvoyees: 2,
        nbErreurs: 0,
        offset: 0
      })
    })

    it('ne notifie pas les jeunes sans token', async () => {
      // Given
      await JeuneSqlModel.create(
        unJeuneMiloDto(
          unJeuneDto({ id: 'j3', pushNotificationToken: null }),
          idStructureMilo
        )
      )

      const job = unJob({ idStructureMilo, idActualite })

      // When
      const result = await handler.handle(job)

      // Then
      expect(notificationRepository.send).to.not.have.been.called()
      expect(result.resultat).to.deep.equal({
        nbEnvoyees: 0,
        nbErreurs: 0,
        offset: 0
      })
    })

    it('respecte la préférence notificationsActualitesMilo du jeune', async () => {
      // Given
      await JeuneSqlModel.create(
        unJeuneMiloDto(
          unJeuneDto({
            id: 'j4',
            pushNotificationToken: 'token-j4',
            notificationsActualitesMilo: false
          }),
          idStructureMilo
        )
      )

      const job = unJob({ idStructureMilo, idActualite })

      // When
      await handler.handle(job)

      // Then
      expect(notificationRepository.send).to.have.been.calledOnce()
      expect(notificationRepository.send.firstCall.args[2]).to.be.false()
    })

    it('envoie la notification avec le bon contenu', async () => {
      // Given
      await JeuneSqlModel.create(
        unJeuneMiloDto(
          unJeuneDto({
            id: 'j5',
            pushNotificationToken: 'token-j5',
            notificationsActualitesMilo: true
          }),
          idStructureMilo
        )
      )

      const job = unJob({ idStructureMilo, idActualite })

      // When
      await handler.handle(job)

      // Then
      const [notification, idJeune, push] =
        notificationRepository.send.firstCall.args
      expect(idJeune).to.equal('j5')
      expect(push).to.be.true()
      expect(notification.token).to.equal('token-j5')
      expect(notification.data.type).to.equal(Notification.Type.NEW_ACTU)
      expect(notification.data.id).to.equal(idActualite)
    })

    it('programme un job suivant quand le batch est plein (100 jeunes)', async () => {
      // Given
      const jeunes = Array.from({ length: 100 }, (_, i) =>
        unJeuneMiloDto(
          unJeuneDto({
            id: `j-batch-${i}`,
            pushNotificationToken: `token-${i}`
          }),
          idStructureMilo
        )
      )
      await JeuneSqlModel.bulkCreate(jeunes)

      const job = unJob({
        idStructureMilo,
        idActualite,
        offset: 0,
        nbEnvoyees: 0
      })

      // When
      await handler.handle(job)

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
      const nextJob = planificateurRepository.ajouterJob.firstCall.args[0]
      expect(nextJob.type).to.equal(
        Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO
      )
      expect(nextJob.contenu?.offset).to.equal(100)
      expect(nextJob.contenu?.idActualite).to.equal(idActualite)
      expect(nextJob.contenu?.idStructureMilo).to.equal(idStructureMilo)
    })

    it('ne programme pas de job suivant quand le batch est incomplet', async () => {
      // Given
      await JeuneSqlModel.create(
        unJeuneMiloDto(
          unJeuneDto({ id: 'j6', pushNotificationToken: 'token-j6' }),
          idStructureMilo
        )
      )

      const job = unJob({ idStructureMilo, idActualite })

      // When
      await handler.handle(job)

      // Then
      expect(planificateurRepository.ajouterJob).to.not.have.been.called()
    })

    it('reprend depuis le bon offset', async () => {
      // Given
      await JeuneSqlModel.bulkCreate([
        unJeuneMiloDto(
          unJeuneDto({ id: 'j7', pushNotificationToken: 'token-j7' }),
          idStructureMilo
        ),
        unJeuneMiloDto(
          unJeuneDto({ id: 'j8', pushNotificationToken: 'token-j8' }),
          idStructureMilo
        )
      ])

      // On simule un 2e batch avec offset=1 → ne traite que j8
      const job = unJob({
        idStructureMilo,
        idActualite,
        offset: 1,
        nbEnvoyees: 1
      })

      // When
      const result = await handler.handle(job)

      // Then
      expect(notificationRepository.send).to.have.been.calledOnce()
      expect(result.resultat).to.deep.equal({
        nbEnvoyees: 2,
        nbErreurs: 0,
        offset: 1
      })
    })
  })
})

function unJob(
  contenu: Planificateur.JobNotifierNouvelleActualiteMilo
): Planificateur.Job<Planificateur.JobNotifierNouvelleActualiteMilo> {
  return {
    dateExecution: maintenant.toJSDate(),
    type: Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO,
    contenu
  }
}

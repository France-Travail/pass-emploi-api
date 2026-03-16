import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../building-blocks/types/job-handler'
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
import { DateService } from '../../utils/date-service'
import { JeuneSqlModel } from '../../infrastructure/sequelize/models/jeune.sql-model'

const MS_ENTRE_CHAQUE_ENVOI_DE_NOTIF = 500
const BATCH_SIZE = 100

@Injectable()
@ProcessJobType(Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO)
export class NotifierNouvelleActualiteMiloJobHandler extends JobHandler<Planificateur.JobNotifierNouvelleActualiteMilo> {
  constructor(
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(
      Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO,
      suiviJobService
    )
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobNotifierNouvelleActualiteMilo>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { idStructureMilo, idActualite } = job.contenu!
    const offset = job.contenu!.offset ?? 0
    let nbEnvoyees = job.contenu!.nbEnvoyees ?? 0
    let nbErreurs = 0
    let succes = true

    try {
      const jeunes = await JeuneSqlModel.findAll({
        where: { idStructureMilo },
        attributes: [
          'id',
          'pushNotificationToken',
          'notificationsActualitesMilo'
        ],
        offset,
        limit: BATCH_SIZE,
        order: [['id', 'ASC']]
      })

      for (const jeune of jeunes) {
        if (!jeune.pushNotificationToken) continue

        try {
          const notification: Notification.Message = {
            token: jeune.pushNotificationToken,
            notification: {
              title: 'Nouvelle actualité',
              body: 'Vous avez une nouvelle actualité'
            },
            data: {
              type: Notification.Type.NEW_ACTU,
              id: idActualite
            }
          }
          await this.notificationRepository.send(
            notification,
            jeune.id,
            jeune.notificationsActualitesMilo
          )
          nbEnvoyees++
        } catch (e) {
          this.logger.error(e)
          nbErreurs++
        }

        await new Promise(resolve =>
          setTimeout(resolve, MS_ENTRE_CHAQUE_ENVOI_DE_NOTIF)
        )
      }

      if (jeunes.length === BATCH_SIZE) {
        await this.planificateurRepository.ajouterJob<Planificateur.JobNotifierNouvelleActualiteMilo>(
          {
            dateExecution: this.dateService.nowJs(),
            type: Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO,
            contenu: {
              idStructureMilo,
              idActualite,
              offset: offset + BATCH_SIZE,
              nbEnvoyees
            }
          }
        )
      }
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: { nbEnvoyees, nbErreurs, offset }
    }
  }
}

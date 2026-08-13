import { Inject, Injectable } from '@nestjs/common'
import { JeuneMiloSansStructure } from '../../building-blocks/types/domain-error'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isSuccess } from '../../building-blocks/types/result'
import {
  JeuneMilo,
  JeuneMiloRepositoryToken
} from '../../domain/milo/jeune.milo'
import {
  SessionMilo,
  SessionMiloRepositoryToken
} from '../../domain/milo/session.milo'
import {
  Notification,
  NotificationRepositoryToken
} from '../../domain/notification/notification'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'

interface Stats {
  idDossier: string
  notificationEnvoyee: boolean
}

@Injectable()
@ProcessJobType(Planificateur.JobType.RAPPEL_SESSION)
export class NotifierRappelInstanceSessionMiloJobHandler extends JobHandler<Planificateur.JobRappelSession> {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    @Inject(SessionMiloRepositoryToken)
    private readonly sessionMiloRepository: SessionMilo.Repository,
    @Inject(JeuneMiloRepositoryToken)
    private readonly jeuneRepository: JeuneMilo.Repository,
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository,
    private readonly dateService: DateService
  ) {
    super(Planificateur.JobType.RAPPEL_SESSION, suiviJobService)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobRappelSession>
  ): Promise<SuiviJob> {
    const debut = this.dateService.now()
    const contenu = job.contenu!
    const stats: Stats = {
      idDossier: contenu.idDossier,
      notificationEnvoyee: false
    }
    let nbErreurs = 0

    try {
      const resultJeune = await this.jeuneRepository.getByIdDossier(
        contenu.idDossier
      )

      if (isSuccess(resultJeune)) {
        const jeune = resultJeune.data
        if (!jeune.structureMilo) {
          throw new JeuneMiloSansStructure(jeune.id)
        }

        const instance = await this.sessionMiloRepository.findInstanceSession(
          contenu.idInstance,
          contenu.idDossier,
          jeune.structureMilo.timezone
        )

        if (
          instance?.statut === SessionMilo.StatutInstance.PRESCRIT &&
          jeune.configuration?.pushNotificationToken
        ) {
          const notification = Notification.creerNotificationRappelSessionMilo(
            jeune.configuration.pushNotificationToken,
            contenu.idSession,
            instance.dateHeureDebut,
            this.dateService
          )
          if (notification) {
            await this.notificationRepository.send(notification, jeune.id)
            stats.notificationEnvoyee = true
          }
        }
      }
    } catch (e) {
      this.logger.error(e)
      nbErreurs = 1
    }
    return {
      jobType: this.jobType,
      dateExecution: debut,
      resultat: stats,
      succes: nbErreurs === 0,
      nbErreurs,
      tempsExecution: DateService.calculerTempsExecution(debut)
    }
  }
}

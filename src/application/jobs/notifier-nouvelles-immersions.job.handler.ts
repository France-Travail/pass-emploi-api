import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { ConfigurationApplication } from '../../domain/jeune/configuration-application'
import { JeuneConfigurationApplicationRepositoryToken } from '../../domain/jeune/jeune'
import { Notification } from '../../domain/notification/notification'
import {
  Recherche,
  RecherchesRepositoryToken
} from '../../domain/offre/recherche/recherche'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const LIMITE_PAGINATION = 100

@Injectable()
@ProcessJobType(Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS)
export class NotifierNouvellesImmersionsJobHandler extends JobHandler<Planificateur.JobNotifierNouvellesImmersions> {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    @Inject(RecherchesRepositoryToken)
    private readonly recherchesRepository: Recherche.Repository,
    @Inject(JeuneConfigurationApplicationRepositoryToken)
    private readonly jeuneConfigurationApplicationRepository: ConfigurationApplication.Repository,
    private readonly notificationService: Notification.Service,
    private readonly dateService: DateService
  ) {
    super(Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS, suiviJobService)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobNotifierNouvellesImmersions>
  ): Promise<SuiviJob> {
    const debut = this.dateService.now()
    const { immersions } = job.contenu!
    let recherchesCorrespondantes = 0
    let nbEchecs = 0
    let premiereCauseDEchec: unknown

    for (const immersion of immersions) {
      if (immersion.location) {
        const query: Recherche.Immersion = {
          rome: immersion.rome,
          lat: immersion.location.lat,
          lon: immersion.location.lon
        }

        let toutesLesRecherchesOntEteAnalysees = false
        let offset = 0

        while (!toutesLesRecherchesOntEteAnalysees) {
          const recherches =
            await this.recherchesRepository.trouverLesRecherchesImmersions(
              query,
              LIMITE_PAGINATION,
              offset
            )

          if (recherches.length < LIMITE_PAGINATION) {
            toutesLesRecherchesOntEteAnalysees = true
          }

          if (recherches.length) {
            recherchesCorrespondantes += recherches.length
            const promises = await Promise.allSettled(
              recherches.map(this.notifier.bind(this))
            )

            promises.forEach(promise => {
              if (promise.status === 'rejected') {
                nbEchecs++
                premiereCauseDEchec ??= promise.reason
              }
            })
          }

          offset += LIMITE_PAGINATION
        }
      }
    }

    if (nbEchecs) {
      rootLogger.error(
        { context: this.jobType, error: toEcsError(premiereCauseDEchec) },
        "Échec de notifications de recherches d'immersion, première cause jointe"
      )
    }

    return {
      jobType: this.jobType,
      dateExecution: debut,
      nbErreurs: nbEchecs,
      succes: true,
      resultat: {
        nombreDeNouvellesOffres: immersions.length,
        recherchesCorrespondantes
      },
      tempsExecution: DateService.calculerTempsExecution(debut)
    }
  }

  async notifier(recherche: Recherche): Promise<void> {
    const configuration =
      await this.jeuneConfigurationApplicationRepository.get(recherche.idJeune)
    await this.notificationService.notifierNouvellesOffres(
      recherche,
      configuration
    )
  }
}

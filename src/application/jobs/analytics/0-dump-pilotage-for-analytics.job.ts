import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { DateService } from '../../../utils/date-service'
import { dumperEtRestaurer } from './dump-restore'

// Tables de pilotage (support) : ne sont référencées que par d'autres tables de la liste, donc restaurables ensemble.
// pg_restore --clean ne peut supprimer une table dont une clé étrangère non dumpée dépend : toute table qui en référence une doit être ajoutée ici.
export const TABLES_PILOTAGE = [
  'fonctionnalite',
  'population',
  'population_conseiller',
  'population_profil',
  'deploiement',
  'communication',
  'communication_envoi'
]

/**
 * Analytics pipeline — rafraîchissement à la demande (hors cron).
 * Dump partiel des tables de pilotage puis recalcul du job 0bis, en quelques
 * secondes, pour voir l'effet d'une population / communication / déploiement
 * modifié dans la journée. Conseillers, jeunes et agences restent à J-1.
 * @see docs/ANALYTICS.md#rafraîchir-avant-lheure
 * @analytics.trigger TASK_NAME=DUMP_PILOTAGE_ANALYTICS
 * @analytics.before CHARGER_POPULATIONS_ANALYTICS
 * @analytics.tables_out fonctionnalite, population, population_conseiller, population_profil, deploiement, communication
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.DUMP_PILOTAGE_ANALYTICS)
export class DumpPilotageForAnalyticsJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(Planificateur.JobType.DUMP_PILOTAGE_ANALYTICS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()

    const erreur = await dumperEtRestaurer(this.logger, {
      DUMP_TABLES: TABLES_PILOTAGE.join(' ')
    })

    const job: Planificateur.Job<void> = {
      dateExecution: this.dateService.nowJs(),
      type: Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS,
      contenu: undefined
    }
    await this.planificateurRepository.ajouterJob(job)

    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: !erreur,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {}
    }
  }
}

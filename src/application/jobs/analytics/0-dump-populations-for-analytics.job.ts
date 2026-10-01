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

// Populations et ce qui s'y rattache (fonctionnalités, déploiements, communications) : ne sont référencées que par d'autres tables de la liste, donc restaurables ensemble.
// pg_restore --clean ne peut supprimer une table dont une clé étrangère non dumpée dépend : toute table qui en référence une doit être ajoutée ici.
export const TABLES_POPULATIONS = [
  'fonctionnalite',
  'population',
  'population_conseiller',
  'population_profil',
  'population_structure_milo',
  'population_agence_ft',
  'deploiement',
  'communication',
  'communication_envoi'
]

/**
 * Analytics pipeline — rafraîchissement à la demande (hors cron).
 * Dump partiel des tables de populations puis recalcul du job 0bis, en quelques
 * secondes, pour voir l'effet d'une population / communication / déploiement
 * modifié dans la journée. Conseillers, jeunes et agences restent à J-1.
 * @see docs/ANALYTICS.md#rafraîchir-avant-lheure
 * @analytics.trigger TASK_NAME=DUMP_POPULATIONS_ANALYTICS
 * @analytics.before CHARGER_POPULATIONS_ANALYTICS
 * @analytics.tables_out fonctionnalite, population, population_conseiller, population_profil, population_structure_milo, population_agence_ft, deploiement, communication, communication_envoi
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.DUMP_POPULATIONS_ANALYTICS)
export class DumpPopulationsForAnalyticsJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(Planificateur.JobType.DUMP_POPULATIONS_ANALYTICS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()

    const erreur = await dumperEtRestaurer(this.logger, {
      DUMP_TABLES: TABLES_POPULATIONS.join(' ')
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

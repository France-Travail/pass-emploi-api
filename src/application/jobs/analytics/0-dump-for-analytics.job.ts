import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { DateService } from '../../../utils/date-service'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'

/**
 * Analytics pipeline — step 0/4 (quotidien).
 * @see docs/ANALYTICS.md#0-dump-for-analyticsjobts
 * @analytics.trigger cron DUMP_ANALYTICS (`30 2 * * *`)
 * @analytics.before CHARGER_EVENEMENTS_ANALYTICS, CHARGER_POPULATIONS_ANALYTICS
 * @analytics.tables_out métier analytics (excl. evenement_engagement*)
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.DUMP_ANALYTICS)
export class DumpForAnalyticsJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(Planificateur.JobType.DUMP_ANALYTICS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    let erreur
    const maintenant = this.dateService.now()

    const cmd = 'yarn run dump-restore-db'
    const { stdout, stderr } = await promisify(exec)(cmd)

    if (stdout) {
      this.logger.log(stdout)
    }

    if (stderr) {
      this.logger.error(stderr)
      erreur = stderr
    }

    for (const type of [
      Planificateur.JobType.CHARGER_EVENEMENTS_ANALYTICS,
      Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS
    ]) {
      const job: Planificateur.Job<void> = {
        dateExecution: this.dateService.nowJs(),
        type,
        contenu: undefined
      }
      await this.planificateurRepository.ajouterJob(job)
    }

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

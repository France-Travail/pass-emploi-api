import { Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Planificateur } from '../../domain/planificateur'
import { estJobSuivi, estNotifiable, SuiviJob } from '../../domain/suivi-job'
import { getAPMInstance } from '../../infrastructure/monitoring/apm.init'
import { rootLogger } from '../../utils/logger.module'
import JobType = Planificateur.JobType

/**
 * Implémente la logique nécessaire à la réalisation du Job envoyé au système.
 */
export abstract class JobHandler<TContenu = void> {
  protected logger: Logger
  protected apmService: APM.Agent
  protected jobType: JobType
  protected suiviJobService: SuiviJob.Service

  constructor(jobType: JobType, suiviJobService: SuiviJob.Service) {
    this.jobType = jobType
    this.logger = new Logger(jobType)
    this.suiviJobService = suiviJobService
    this.apmService = getAPMInstance()
  }

  async execute(
    job?: Planificateur.Job<TContenu>
  ): Promise<SuiviJob | undefined> {
    const startNs = process.hrtime.bigint()
    try {
      if (!job) {
        return undefined
      }

      const suiviJob = await this.handle(job)

      if (estJobSuivi(suiviJob.jobType)) {
        this.suiviJobService.save(suiviJob)
      }
      if (estNotifiable(suiviJob)) {
        this.suiviJobService.notifierResultatJob(suiviJob)
      }

      this.logExecution(startNs, suiviJob, undefined)
      return suiviJob
    } catch (e) {
      this.apmService.captureError(e)
      this.logExecution(startNs, undefined, e)
      throw e
    }
  }

  abstract handle(job: Planificateur.Job<TContenu>): Promise<SuiviJob>

  private logExecution(
    startNs: bigint,
    suiviJob: SuiviJob | undefined,
    error: Error | undefined
  ): void {
    const outcome =
      error || (suiviJob && !suiviJob.succes) ? 'failure' : 'success'
    const level = outcome === 'failure' ? 'error' : 'info'

    rootLogger[level](
      {
        context: this.jobType,
        event: {
          action: 'handler_executed',
          outcome,
          duration: Number(process.hrtime.bigint() - startNs)
        },
        ...(error && { err: error })
      },
      'handler_executed'
    )
  }
}

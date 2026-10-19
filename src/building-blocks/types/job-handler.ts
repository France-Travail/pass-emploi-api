import { Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Planificateur } from '../../domain/planificateur'
import { estJobSuivi, estNotifiable, SuiviJob } from '../../domain/suivi-job'
import { getAPMInstance } from '../../infrastructure/monitoring/apm.init'
import { logHandlerExecuted } from '../../utils/logger.module'
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

      if (!suiviJob.silencieux) {
        this.logExecution(job, startNs, suiviJob, undefined)
      }
      return suiviJob
    } catch (e) {
      this.apmService.captureError(e)
      this.logExecution(job, startNs, undefined, e)
      throw e
    }
  }

  abstract handle(job: Planificateur.Job<TContenu>): Promise<SuiviJob>

  // Labels ECS additionnels portés par `handler_executed`, en plus de `job_type`.
  // Appelé aussi sur le chemin d'erreur : doit rester une lecture de champs.
  protected labelsDuLog(
    _job: Planificateur.Job<TContenu>
  ): Record<string, string | string[]> | undefined {
    return undefined
  }

  private logExecution(
    job: Planificateur.Job<TContenu> | undefined,
    startNs: bigint,
    suiviJob: SuiviJob | undefined,
    error: Error | undefined
  ): void {
    logHandlerExecuted({
      context: this.jobType,
      startNs,
      error: error ?? suiviJob?.erreur,
      failed: !!suiviJob && !suiviJob.succes,
      extra: {
        labels: {
          job_type: this.jobType,
          ...(job && this.labelsDuLog(job))
        }
      }
    })
  }
}

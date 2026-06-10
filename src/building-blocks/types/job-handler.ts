import { Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { DateTime } from 'luxon'
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

      this.enregistrerEtNotifierRapportJob(suiviJob)
      this.logExecution(startNs, suiviJob, undefined)
      return suiviJob
    } catch (e) {
      const erreur = e instanceof Error ? e : new Error(String(e))
      this.apmService.captureError(erreur)
      const suiviJob: SuiviJob = {
        jobType: this.jobType,
        dateExecution: DateTime.now(),
        succes: false,
        resultat: {},
        nbErreurs: 1,
        tempsExecution: Number(process.hrtime.bigint() - startNs) / 1_000_000,
        erreur: { message: erreur.message, stack: erreur.stack }
      }
      this.enregistrerEtNotifierRapportJob(suiviJob)
      this.logExecution(startNs, suiviJob, erreur)
      throw e
    }
  }

  abstract handle(job: Planificateur.Job<TContenu>): Promise<SuiviJob>

  private enregistrerEtNotifierRapportJob(suiviJob: SuiviJob): void {
    if (estJobSuivi(suiviJob.jobType)) {
      this.suiviJobService.save(suiviJob)
    }
    if (estNotifiable(suiviJob)) {
      this.suiviJobService.notifierResultatJob(suiviJob)
    }
  }

  private logExecution(
    startNs: bigint,
    suiviJob: SuiviJob | undefined,
    error: Error | undefined
  ): void {
    logHandlerExecuted({
      context: this.jobType,
      startNs,
      error,
      failed: !!suiviJob && !suiviJob.succes,
      extra: { labels: { job_type: this.jobType } }
    })
  }
}

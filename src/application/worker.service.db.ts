import { Inject, Injectable, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import * as apm from 'elastic-apm-node'
import { JobHandlerProviders } from '../app.module'
import { JobHandler } from '../building-blocks/types/job-handler'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../domain/planificateur'
import { SuiviJob } from '../domain/suivi-job'
import { getAPMInstance } from '../infrastructure/monitoring/apm.init'
import {
  WorkerTrackingService,
  getWorkerTrackingServiceInstance
} from '../infrastructure/monitoring/worker.tracking.service'
import { rootLogger, toEcsError } from '../utils/logger.module'

const LOGGER_CONTEXT = 'WorkerService'

@Injectable()
export class WorkerService {
  private apmService: apm.Agent
  private workerTrackingService: WorkerTrackingService

  constructor(
    @Inject(PlanificateurRepositoryToken)
    private planificateurRepository: Planificateur.Repository,
    private moduleRef: ModuleRef
  ) {
    this.apmService = getAPMInstance()
    this.workerTrackingService = getWorkerTrackingServiceInstance()
  }

  subscribe(): void {
    this.planificateurRepository.subscribe(this.handler.bind(this))
  }

  async handler(job: Planificateur.Job<unknown>): Promise<void> {
    const jobName = `JOB-${job.type}`
    this.workerTrackingService.startJobTracking(jobName)
    const transaction = this.apmService.startTransaction(jobName, 'worker')
    const startTimeNs = process.hrtime.bigint()
    let success = true
    rootLogger.info(
      {
        context: LOGGER_CONTEXT,
        event: { action: 'job_started' },
        labels: { job_type: job.type }
      },
      'job_started'
    )
    let suivi: SuiviJob | undefined
    try {
      const jobHandlerType = getJobHandlerTypeByJobType(job)
      if (jobHandlerType) {
        const jobhandler =
          this.moduleRef.get<JobHandler<unknown>>(jobHandlerType)
        suivi = await jobhandler.execute(job)
      } else {
        success = false
        rootLogger.error(
          {
            context: LOGGER_CONTEXT,
            event: {
              action: 'job_handler_not_found',
              outcome: 'failure'
            },
            labels: { job_type: job.type }
          },
          'job_handler_not_found'
        )
      }
    } catch (e) {
      success = false
      rootLogger.error(
        {
          context: LOGGER_CONTEXT,
          event: { action: 'job_crashed', outcome: 'failure' },
          labels: { job_type: job.type },
          error: toEcsError(e)
        },
        'job_crashed'
      )
    } finally {
      const durationNs = Number(process.hrtime.bigint() - startTimeNs)
      rootLogger[success ? 'info' : 'error'](
        {
          context: LOGGER_CONTEXT,
          event: {
            action: 'job_completed',
            outcome: success ? 'success' : 'failure',
            duration: durationNs
          },
          labels: { job_type: job.type }
        },
        'job_completed'
      )
      if (transaction && !success) {
        transaction.result = 'error'
        transaction.end('failure')
      } else if (transaction && success) {
        transaction.end('success')
      }
      if (suivi?.succes === false || !success) {
        // On veut passer le job en fail sur le planificateur
        throw new Error(`${jobName} en échec`)
      }
    }
  }
}

function getJobHandlerTypeByJobType(
  job: Planificateur.Job<unknown>
): Type | undefined {
  return JobHandlerProviders.find(
    jobProvider => job.type === Reflect.getMetadata('jobType', jobProvider)
  )
}

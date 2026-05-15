import { AsyncLocalStorage } from 'node:async_hooks'
import { v4 as uuidV4 } from 'uuid'

let workerTrackingServiceInstance: WorkerTrackingService

export interface JobTracking {
  name?: string
  jobRunId?: string
}

export class WorkerTrackingService {
  private asyncLocalStorage = new AsyncLocalStorage()

  getCurrentJobTracking(): JobTracking {
    const jobTracking: JobTracking | undefined =
      this.asyncLocalStorage.getStore() as JobTracking | undefined
    return jobTracking ?? {}
  }

  startJobTracking(name: string): string {
    const jobRunId = uuidV4()
    const jobTracking: JobTracking = { name, jobRunId }
    this.asyncLocalStorage.enterWith(jobTracking)
    return jobRunId
  }
}

export function getWorkerTrackingServiceInstance(): WorkerTrackingService {
  if (workerTrackingServiceInstance == null) {
    workerTrackingServiceInstance = new WorkerTrackingService()
  }
  return workerTrackingServiceInstance
}

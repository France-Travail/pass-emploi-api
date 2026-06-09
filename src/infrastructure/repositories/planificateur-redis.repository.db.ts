import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Bull, * as QueueBull from 'bull'
import { DateTime, Duration } from 'luxon'
import { Planificateur } from '../../domain/planificateur'
import { NettoyageJobsStats } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { NonTrouveError } from '../../building-blocks/types/domain-error'

const CRON_TIMEZONE = 'Europe/Paris'
export const REDIS_QUEUE_NAME = 'JobQueue'

const MAX_NUMBER_REDIS_JOBS = 50

@Injectable()
export class PlanificateurRedisRepository implements Planificateur.Repository {
  queue: Bull.Queue
  private isReady = false
  private logger: Logger

  constructor(
    private configService: ConfigService,
    private dateService: DateService
  ) {
    this.logger = new Logger('PlanificateurRedisRepository')
    this.queue = new QueueBull(
      REDIS_QUEUE_NAME,
      this.configService.get('redis').url,
      {
        redis: {
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
          retryStrategy: (times: number): number => {
            if (times > 1) {
              this.logger.error(
                'could not connect to redis!' + times.toString()
              )
            }
            this.isReady = true
            return 1000
          }
        }
      }
    )
    this.queue.isReady().then(() => {
      this.isReady = true
    })
  }

  async ajouterJob<T>(
    job: Planificateur.Job<T>,
    jobId?: string,
    params?: Planificateur.JobParams
  ): Promise<string> {
    if (this.isReady) {
      const now = this.dateService.now()
      const delay = DateTime.fromJSDate(job.dateExecution).diff(
        now
      ).milliseconds
      const jobOptions: Bull.JobOptions = {
        jobId: jobId,
        delay: delay,
        attempts: params?.attempts || 1,
        backoff: params?.backoff?.delay || 0,
        priority: params?.priority || 0
      }
      const bullJob = await this.queue.add(job, jobOptions)
      return String(bullJob.id)
    } else {
      throw new Error('Redis not ready to accept connection')
    }
  }

  async supprimerLesJobs(): Promise<void> {
    await this.queue.removeJobs('*')
  }

  async subscribe(handle: Planificateur.Handler<unknown>): Promise<void> {
    this.queue.process(async jobRedis => {
      const job: Planificateur.Job<unknown> = {
        dateExecution: jobRedis.data.date,
        type: jobRedis.data.type,
        contenu: jobRedis.data.contenu
      }
      return handle(job)
    })
  }

  async isQueueReady(): Promise<Bull.Queue> {
    return this.queue.isReady()
  }

  getQueue(): Bull.Queue {
    return this.queue
  }

  async disconnect(): Promise<void> {
    await this.queue.close()
  }

  async ajouterCronJob(cron: Planificateur.CronJob): Promise<void> {
    await this.queue.add(cron, {
      jobId: cron.type,
      repeat: {
        cron: cron.expression,
        tz: CRON_TIMEZONE,
        startDate: cron.dateDebutExecution
      }
    })
  }

  async supprimerLesCronJobs(): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs()
    for (const job of repeatableJobs) {
      await this.queue.removeRepeatable({
        cron: job.cron,
        tz: job.tz,
        jobId: job.id
      })
    }
  }

  async supprimerLesJobsPasses(): Promise<NettoyageJobsStats> {
    const ilYA7Jours = Duration.fromObject({ day: 7 }).toMillis()
    const [completed, failed] = await Promise.all([
      this.queue.clean(ilYA7Jours, 'completed'),
      this.queue.clean(ilYA7Jours, 'failed')
    ])
    return {
      nbJobsNettoyes: completed.length,
      nbJobsEnEchecNettoyes: failed.length
    }
  }

  async supprimerLesJobsSelonPattern(pattern: string): Promise<void> {
    await this.queue.removeJobs(`*${pattern}*`)
  }

  async estEnCoursDeTraitement(
    jobType: Planificateur.JobType
  ): Promise<boolean> {
    const activeJobs = await this.queue.getActive(0, MAX_NUMBER_REDIS_JOBS)
    return activeJobs.some(job => job.data.type === jobType)
  }

  async existePlusQuUnJobActifDeCeType(
    jobType: Planificateur.JobType
  ): Promise<boolean> {
    const activeJobs = await this.queue.getActive(0, MAX_NUMBER_REDIS_JOBS)
    return activeJobs.filter(job => job.data.type === jobType).length > 1
  }

  async recupererPremierJobNonTermine(
    jobType: Planificateur.JobType
  ): Promise<string | null> {
    const jobsNonTermines = await this.recupererJobsNonTermines()
    const job = jobsNonTermines?.find(job => job?.data?.type === jobType)
    if (!job || !job.id) return null
    return String(job.id)
  }

  async getJobInformations(jobId: Planificateur.JobId): Promise<Bull.Job> {
    const job = await this.queue.getJob(jobId.jobId)
    if (!job) throw new NonTrouveError('Job', jobId.jobId)
    return job
  }

  async compterLesJobs(): Promise<Planificateur.StatsJobs> {
    // getJobCounts ne renvoie pas le compteur paused → récupéré à part
    const [counts, paused] = await Promise.all([
      this.queue.getJobCounts(),
      this.queue.getPausedCount()
    ])
    const parStatut: Record<Planificateur.StatutJob, number> = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      paused: paused ?? 0
    }

    const statutsVivants: Array<'waiting' | 'active' | 'delayed' | 'failed'> = [
      'waiting',
      'active',
      'delayed',
      'failed'
    ]

    const jobsParStatut = await Promise.all(
      statutsVivants.map(async statut => {
        const jobs = await this.queue.getJobs(
          [statut],
          0,
          MAX_NUMBER_REDIS_JOBS - 1
        )
        return { statut, jobs }
      })
    )

    const compteurParType: Partial<
      Record<
        Planificateur.JobType,
        Record<'waiting' | 'active' | 'delayed' | 'failed', number>
      >
    > = {}

    for (const { statut, jobs } of jobsParStatut) {
      for (const job of jobs) {
        const type: Planificateur.JobType = job.data.type
        compteurParType[type] ??= {
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0
        }
        compteurParType[type][statut]++
      }
    }

    const parTypeStatutsVivants = Object.entries(compteurParType).map(
      ([type, countsParStatut]) => ({
        type: type as Planificateur.JobType,
        waiting: countsParStatut.waiting,
        active: countsParStatut.active,
        delayed: countsParStatut.delayed,
        failed: countsParStatut.failed,
        total:
          countsParStatut.waiting +
          countsParStatut.active +
          countsParStatut.delayed +
          countsParStatut.failed
      })
    )

    return { parStatut, parTypeStatutsVivants }
  }

  async listerJobs(options: {
    statut: Planificateur.StatutJob
    jobType?: Planificateur.JobType
    debut?: number
    fin?: number
  }): Promise<Bull.Job[]> {
    const jobs = await this.queue.getJobs(
      [options.statut],
      options.debut ?? 0,
      options.fin ?? 20
    )
    if (options.jobType) {
      return jobs.filter(job => job.data.type === options.jobType)
    }
    return jobs
  }

  private async recupererJobsNonTermines(): Promise<Bull.Job[]> {
    return await this.queue.getJobs(
      ['active', 'delayed', 'waiting', 'paused'],
      0,
      MAX_NUMBER_REDIS_JOBS
    )
  }
}

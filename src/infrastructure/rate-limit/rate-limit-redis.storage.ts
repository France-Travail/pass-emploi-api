import { Injectable } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const TIMEOUT_MS = 200
const LOG_THROTTLE_MS = 60000

@Injectable()
export class RateLimitRedisStorage implements ThrottlerStorage {
  private client: RedisClientType
  private connexion: Promise<void> | undefined
  private lastErrorLogTime = 0

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      disableOfflineQueue: true
    })

    this.client.on('error', () => {
      // Sans ce listener, node-redis crashe le process sur erreur de connexion
    })
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const operation = async (): Promise<[number, number]> => {
      if (!this.connexion) {
        this.connexion = this.client
          .connect()
          .then(() => undefined)
          .catch(() => undefined)
      }

      if (!this.client.isReady) {
        await this.connexion
        if (!this.client.isReady) {
          throw new Error('Redis not ready')
        }
      }

      return await this.executeRedisOperation(key, ttl)
    }

    try {
      const result = await this.avecTimeout(operation())

      if (!result) {
        this.logErrorThrottled(new Error('Redis operation timeout'))
        return this.failOpenRecord()
      }

      const [totalHits, ttlResult] = result
      const timeToExpire = Math.max(0, Math.ceil(ttlResult / 1000))

      return {
        totalHits,
        timeToExpire,
        isBlocked: totalHits > limit,
        timeToBlockExpire: timeToExpire
      }
    } catch (error) {
      this.logErrorThrottled(error)
      return this.failOpenRecord()
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      this.client.destroy()
    }
  }

  private async executeRedisOperation(
    key: string,
    ttl: number
  ): Promise<[number, number]> {
    const multi = this.client.multi()
    multi.incr(key)
    multi.pExpire(key, ttl, 'NX')
    multi.pTTL(key)

    const results = await multi.exec()

    if (!results || results.length < 3) {
      throw new Error('Redis MULTI command failed')
    }

    const totalHits = results[0] as number
    const ttlResult = results[2] as number

    return [totalHits, ttlResult]
  }

  private async avecTimeout<T>(promesse: Promise<T>): Promise<T | undefined> {
    let timerId: NodeJS.Timeout | undefined

    const timeout = new Promise<undefined>(resolve => {
      timerId = setTimeout(() => resolve(undefined), TIMEOUT_MS)
    })

    try {
      promesse.catch(() => undefined)
      return await Promise.race([promesse, timeout])
    } finally {
      if (timerId) clearTimeout(timerId)
    }
  }

  private failOpenRecord(): ThrottlerStorageRecord {
    return {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0
    }
  }

  private logErrorThrottled(error: unknown): void {
    const now = Date.now()
    if (now - this.lastErrorLogTime >= LOG_THROTTLE_MS) {
      this.lastErrorLogTime = now
      rootLogger.error(
        {
          context: 'RateLimitRedisStorage',
          event: { action: 'rate_limit_storage_failed', outcome: 'failure' },
          error: toEcsError(error)
        },
        'rate_limit_storage_failed'
      )
    }
  }
}

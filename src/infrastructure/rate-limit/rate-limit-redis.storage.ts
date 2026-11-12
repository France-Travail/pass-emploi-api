import { Injectable } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { ThrottlerStorage, ThrottlerStorageRecord } from '@nestjs/throttler'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const TIMEOUT_MS = 200
const LOG_THROTTLE_MS = 60000

@Injectable()
export class RateLimitRedisStorage implements ThrottlerStorage {
  private client: RedisClientType
  private connected = false
  private connecting = false
  private connectionPromise: Promise<void> | null = null
  private lastErrorLogTime = 0

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      disableOfflineQueue: true
    })

    this.client.on('error', () => {
      // noop - erreurs traitées dans increment via fail-open
    })
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    try {
      await this.ensureConnected()

      const operation = this.executeRedisOperation(key, ttl)
      const timeout = this.createTimeout()

      const result = await Promise.race([operation, timeout])

      if (!result) {
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
    if (this.connected) {
      try {
        await this.client.disconnect()
      } catch {
        // noop - best effort cleanup
      }
      this.connected = false
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return
    }

    if (this.connecting && this.connectionPromise) {
      await this.connectionPromise
      return
    }

    this.connecting = true
    this.connectionPromise = this.client
      .connect()
      .then(() => {
        this.connected = true
        this.connecting = false
      })
      .catch(() => {
        this.connecting = false
        this.connectionPromise = null
        throw new Error('Redis connection failed')
      })

    await this.connectionPromise
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

  private createTimeout(): Promise<null> {
    return new Promise(resolve => {
      setTimeout(() => resolve(null), TIMEOUT_MS)
    })
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

import { Injectable } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const TIMEOUT_MS = 200
const LOG_THROTTLE_MS = 60000
const INCREMENTS_EN_ATTENTE_MAX = 100
const SCRIPT_INCREMENT = `
local totalHits = redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ARGV[1], 'NX')
return { totalHits, redis.call('PTTL', KEYS[1]) }
`

interface Appel {
  abandonne: boolean
}

@Injectable()
export class RateLimitRedisStorage implements ThrottlerStorage {
  private readonly client: RedisClientType
  private connexion: Promise<void> | undefined
  private attenteDeConnexionExpiree = false
  private dernierLogDePanne = Number.NEGATIVE_INFINITY

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
      commandsQueueMaxLength: INCREMENTS_EN_ATTENTE_MAX
    })

    this.client.on('error', () => {
      // Sans ce listener, node-redis crashe le process sur erreur de connexion
    })
    this.client.on('ready', () => {
      this.attenteDeConnexionExpiree = false
    })
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const appel: Appel = { abandonne: false }

    try {
      const result = await this.avecTimeout(this.incrementer(key, ttl, appel))

      if (!result) {
        appel.abandonne = true
        if (!this.client.isReady) {
          this.attenteDeConnexionExpiree = true
        }
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

  onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      this.client.destroy()
    }
    return Promise.resolve()
  }

  private async incrementer(
    key: string,
    ttl: number,
    appel: Appel
  ): Promise<[number, number]> {
    if (!this.client.isReady) {
      if (this.attenteDeConnexionExpiree) {
        throw new Error('Redis not ready')
      }
      await this.connecter()
      if (appel.abandonne || !this.client.isReady) {
        throw new Error('Redis not ready')
      }
    }

    return await this.executeRedisOperation(key, ttl)
  }

  private connecter(): Promise<void> {
    this.connexion ??= this.client
      .connect()
      .then(() => undefined)
      .catch(() => undefined)
    return this.connexion
  }

  private async executeRedisOperation(
    key: string,
    ttl: number
  ): Promise<[number, number]> {
    const results = await this.client.eval(SCRIPT_INCREMENT, {
      keys: [key],
      arguments: [String(ttl)]
    })

    if (!Array.isArray(results) || results.length < 2) {
      throw new Error('Redis EVAL command failed')
    }

    const [totalHits, ttlResult] = results

    if (typeof totalHits !== 'number' || typeof ttlResult !== 'number') {
      throw new TypeError('Redis EVAL returned unexpected types')
    }

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
    if (now - this.dernierLogDePanne >= LOG_THROTTLE_MS) {
      this.dernierLogDePanne = now
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

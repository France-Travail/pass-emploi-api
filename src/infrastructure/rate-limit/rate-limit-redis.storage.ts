import { Injectable } from '@nestjs/common'
import { createClient, RedisClientType } from 'redis'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import { rootLogger, toEcsError } from '../../utils/logger.module'

const TIMEOUT_MS = 200
const LOG_THROTTLE_MS = 60000
const COMMANDES_PAR_INCREMENT = 5
const INCREMENTS_EN_ATTENTE_MAX = 100

interface Appel {
  abandonne: boolean
}

@Injectable()
export class RateLimitRedisStorage implements ThrottlerStorage {
  private client: RedisClientType
  private connexion: Promise<void> | undefined
  private attenteDeConnexionExpiree = false
  private dernierLogDePanne = Number.NEGATIVE_INFINITY

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
      // Multiple du nombre de commandes d'un incrément : une file pleine refuse
      // un MULTI entier, jamais son EXEC seul.
      commandsQueueMaxLength:
        INCREMENTS_EN_ATTENTE_MAX * COMMANDES_PAR_INCREMENT
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

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      this.client.destroy()
    }
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
    const results = await this.client
      .multi()
      .incr(key)
      .pExpire(key, ttl, 'NX')
      .pTTL(key)
      .exec()

    if (!results || results.length < 3) {
      throw new Error('Redis MULTI command failed')
    }

    const totalHits = results[0]
    const ttlResult = results[2]

    if (typeof totalHits !== 'number' || typeof ttlResult !== 'number') {
      throw new Error('Redis MULTI returned unexpected types')
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

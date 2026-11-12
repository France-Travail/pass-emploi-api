import { expect } from '../../utils'
import { createSandbox, SinonSandbox } from 'sinon'
import { RateLimitRedisStorage } from '../../../src/infrastructure/rate-limit/rate-limit-redis.storage'
import { testConfig } from '../../utils/test-config'
import { getDatabase } from '../../utils/database-for-testing'
import { rootLogger } from '../../../src/utils/root-logger'

describe('RateLimitRedisStorage', () => {
  let sandbox: SinonSandbox
  let storage: RateLimitRedisStorage

  before(async () => {
    await getDatabase().cleanRedis()
  })

  beforeEach(() => {
    sandbox = createSandbox()
    const redisUrl = testConfig().get('redis').url
    storage = new RateLimitRedisStorage(redisUrl)
  })

  afterEach(async () => {
    await storage.onModuleDestroy()
    sandbox.restore()
  })

  describe('increment', () => {
    it('compte les requêtes dans la fenêtre', async () => {
      // Given
      const key = 'test-key-1'
      const ttl = 60000
      const limit = 2
      const blockDuration = 60000
      const throttlerName = 'utilisateur'

      // When
      const result1 = await storage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      )
      const result2 = await storage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      )
      const result3 = await storage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      )

      // Then
      expect(result1.totalHits).to.equal(1)
      expect(result1.isBlocked).to.equal(false)

      expect(result2.totalHits).to.equal(2)
      expect(result2.isBlocked).to.equal(false)

      expect(result3.totalHits).to.equal(3)
      expect(result3.isBlocked).to.equal(true)
    })

    it('ouvre une nouvelle fenêtre quand le compteur expire', async () => {
      // Given
      const key = 'test-key-2'
      const ttl = 100
      const limit = 2
      const blockDuration = 100
      const throttlerName = 'utilisateur'

      // When
      await storage.increment(key, ttl, limit, blockDuration, throttlerName)
      await storage.increment(key, ttl, limit, blockDuration, throttlerName)

      await new Promise(resolve => setTimeout(resolve, 150))

      const result = await storage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      )

      // Then
      expect(result.totalHits).to.equal(1)
    })

    it('renvoie le temps restant en secondes', async () => {
      // Given
      const key = 'test-key-3'
      const ttl = 60000
      const limit = 2
      const blockDuration = 60000
      const throttlerName = 'utilisateur'

      // When
      const result = await storage.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName
      )

      // Then
      expect(result.timeToExpire).to.be.within(59, 60)
      expect(result.timeToBlockExpire).to.equal(result.timeToExpire)
    })

    it('laisse passer quand Redis ne répond pas', async () => {
      // Given
      sandbox.stub(rootLogger, 'error')
      const failingStorage = new RateLimitRedisStorage('redis://localhost:1')
      const start = Date.now()

      // When
      const result = await failingStorage.increment(
        'key',
        60000,
        10,
        60000,
        'utilisateur'
      )
      const duration = Date.now() - start

      // Then
      expect(result.isBlocked).to.equal(false)
      expect(result.totalHits).to.equal(0)
      expect(duration).to.be.lessThan(500)

      // Cleanup
      await failingStorage.onModuleDestroy()
    })

    it("ne logue la panne Redis qu'une fois par minute", async () => {
      // Given
      const clock = sandbox.useFakeTimers({ toFake: ['Date'] })
      const loggerStub = sandbox.stub(rootLogger, 'error')
      const failingStorage = new RateLimitRedisStorage('redis://localhost:1')

      // When
      await failingStorage.increment('key', 60000, 10, 60000, 'utilisateur')
      await failingStorage.increment('key', 60000, 10, 60000, 'utilisateur')
      await failingStorage.increment('key', 60000, 10, 60000, 'utilisateur')

      // Then
      expect(loggerStub.callCount).to.equal(1)

      // When - après 60 secondes
      clock.tick(60000)
      await failingStorage.increment('key', 60000, 10, 60000, 'utilisateur')

      // Then
      expect(loggerStub.callCount).to.equal(2)

      // Cleanup
      clock.restore()
      await failingStorage.onModuleDestroy()
    })
  })
})

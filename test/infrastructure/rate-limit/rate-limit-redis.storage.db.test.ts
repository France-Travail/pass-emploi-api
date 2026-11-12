import { AddressInfo, createServer, Server, Socket } from 'net'
import { createClient } from 'redis'
import { expect } from '../../utils'
import { createSandbox, SinonSandbox } from 'sinon'
import { RateLimitRedisStorage } from '../../../src/infrastructure/rate-limit/rate-limit-redis.storage'
import { testConfig } from '../../utils/test-config'
import { getDatabase } from '../../utils/database-for-testing'
import { rootLogger } from '../../../src/utils/root-logger'

interface ServeurTcp {
  port: number
  fermer: () => Promise<void>
}

async function demarrerServeurTcp(
  surConnexion: (socket: Socket) => void,
  port = 0
): Promise<ServeurTcp> {
  const sockets = new Set<Socket>()
  const serveur: Server = createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => undefined)
    surConnexion(socket)
  })
  await new Promise<void>(resolve => serveur.listen(port, resolve))
  return {
    port: (serveur.address() as AddressInfo).port,
    fermer: async (): Promise<void> => {
      sockets.forEach(socket => socket.destroy())
      await new Promise(resolve => serveur.close(resolve))
    }
  }
}

async function unPortLibre(): Promise<number> {
  const serveur = await demarrerServeurTcp(() => undefined)
  await serveur.fermer()
  return serveur.port
}

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

    it("n'attend plus la connexion une fois une première attente expirée", async () => {
      // Given
      sandbox.stub(rootLogger, 'error')
      const failingStorage = new RateLimitRedisStorage('redis://localhost:1')
      await failingStorage.increment('key', 60000, 10, 60000, 'utilisateur')
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
      expect(duration).to.be.lessThan(50)

      // Cleanup
      await failingStorage.onModuleDestroy()
    })

    it('laisse passer en 200 ms quand Redis accepte la connexion sans répondre', async () => {
      // Given
      sandbox.stub(rootLogger, 'error')
      const serveurMuet = await demarrerServeurTcp(() => undefined)
      const slowStorage = new RateLimitRedisStorage(
        `redis://localhost:${serveurMuet.port}`
      )
      const start = Date.now()

      try {
        // When
        const result = await slowStorage.increment(
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
        expect(duration).to.be.within(190, 500)
      } finally {
        // Cleanup
        await slowStorage.onModuleDestroy()
        await serveurMuet.fermer()
      }
    })

    it("n'exécute pas après le retour de Redis un incrément déjà abandonné", async () => {
      // Given
      sandbox.stub(rootLogger, 'error')
      const port = await unPortLibre()
      const storageSansRedis = new RateLimitRedisStorage(
        `redis://localhost:${port}`
      )
      const verificateur = createClient({ url: testConfig().get('redis').url })
      await verificateur.connect()
      let proxy: ServeurTcp | undefined

      try {
        await storageSansRedis.increment(
          'cle-abandonnee',
          60000,
          10,
          60000,
          'utilisateur'
        )

        // When
        const { hostname, port: portRedis } = new URL(
          testConfig().get('redis').url
        )
        proxy = await demarrerServeurTcp(socket => {
          const versRedis = new Socket()
          versRedis.on('error', () => socket.destroy())
          socket.on('close', () => versRedis.destroy())
          versRedis.connect(Number(portRedis), hostname, () => {
            socket.pipe(versRedis).pipe(socket)
          })
        }, port)
        let sonde = { totalHits: 0 }
        while (sonde.totalHits === 0) {
          await new Promise(resolve => setTimeout(resolve, 50))
          sonde = await storageSansRedis.increment(
            'cle-sonde',
            60000,
            10,
            60000,
            'utilisateur'
          )
        }
        await new Promise(resolve => setImmediate(resolve))

        // Then
        expect(await verificateur.get('cle-abandonnee')).to.be.null()
      } finally {
        // Cleanup
        await storageSansRedis.onModuleDestroy()
        await proxy?.fermer()
        verificateur.destroy()
      }
    })
  })
})

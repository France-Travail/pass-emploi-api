import { ClassProvider, INestApplication } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TerminusModule } from '@nestjs/terminus'
import { Test } from '@nestjs/testing'
import { getStorageToken, ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import { JWTPayload } from 'jose'
import { createSandbox, SinonSandbox, SinonStub } from 'sinon'
import * as request from 'supertest'
import { buildModuleMetadata } from '../../../src/app.module'
import { JwtService } from '../../../src/infrastructure/auth/jwt.service'
import { OidcAuthGuard } from '../../../src/infrastructure/auth/oidc.auth-guard'
import {
  estUnPalierDeRefus,
  RateLimitGuard
} from '../../../src/infrastructure/rate-limit/rate-limit.guard'
import { RateLimitModule } from '../../../src/infrastructure/rate-limit/rate-limit.module'
import { HealthController } from '../../../src/infrastructure/routes/health.controller'
import { rootLogger } from '../../../src/utils/logger.module'
import {
  unHeaderAuthorization,
  unJwtPayloadValideInvite,
  unJwtPayloadValideJeunePE
} from '../../fixtures/authentification.fixture'
import { expect } from '../../utils'
import { FakeJwtService } from '../../utils/module-for-testing'
import { FakeRateLimitController } from './fake-rate-limit.controller'

class StockageEnFenetreFixe implements ThrottlerStorage {
  private readonly compteurs = new Map<string, number>()

  async increment(
    key: string,
    ttl: number,
    limit: number
  ): Promise<ThrottlerStorageRecord> {
    const totalHits = (this.compteurs.get(key) ?? 0) + 1
    this.compteurs.set(key, totalHits)
    const timeToExpire = Math.ceil(ttl / 1000)
    return {
      totalHits,
      timeToExpire,
      isBlocked: totalHits > limit,
      timeToBlockExpire: timeToExpire
    }
  }
}

class StockageEnPanne implements ThrottlerStorage {
  async increment(): Promise<ThrottlerStorageRecord> {
    throw new Error('panne')
  }
}

interface LimitesUtilisateur {
  JEUNE: number
  INVITE: number
  CONSEILLER: number
  SUPPORT: number
}

const uneConfigRateLimit = (
  limitesUtilisateur: Partial<LimitesUtilisateur> = {}
): object => ({
  actif: true,
  utilisateur: {
    fenetreSecondes: 60,
    limites: {
      JEUNE: 2,
      INVITE: 1,
      CONSEILLER: 2,
      SUPPORT: 2,
      ...limitesUtilisateur
    }
  },
  ip: { fenetreSecondes: 60, limite: 2 },
  routeCouteuse: { fenetreSecondes: 60, limite: 1 }
})

describe('RateLimitGuard', () => {
  let app: INestApplication
  let sandbox: SinonSandbox
  let logInfo: SinonStub

  beforeEach(() => {
    sandbox = createSandbox()
    logInfo = sandbox.stub(rootLogger, 'info')
    sandbox.stub(rootLogger, 'error')
  })

  afterEach(async () => {
    sandbox.restore()
    await app?.close()
  })

  async function demarrerApp({
    rateLimit = uneConfigRateLimit(),
    payload = unJwtPayloadValideJeunePE(),
    stockage = new StockageEnFenetreFixe()
  }: {
    rateLimit?: object
    payload?: JWTPayload
    stockage?: ThrottlerStorage
  } = {}): Promise<request.Agent> {
    const testingModule = await Test.createTestingModule({
      imports: [ConfigModule, TerminusModule, RateLimitModule],
      controllers: [FakeRateLimitController, HealthController],
      providers: [
        { provide: JwtService, useValue: new FakeJwtService(true, payload) },
        { provide: APP_GUARD, useClass: OidcAuthGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard }
      ]
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          redis: { url: 'redis://localhost:6767' },
          rateLimit
        })
      )
      .overrideProvider(getStorageToken())
      .useValue(stockage)
      .compile()

    app = testingModule.createNestApplication()
    await app.init()
    return request(app.getHttpServer())
  }

  const logsRateLimitExceeded = (): unknown[][] =>
    logInfo.args.filter(([log]) => log?.event?.action === 'rate_limit_exceeded')

  it('renvoie 429 et Retry-After au-delà de la limite utilisateur', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    let derniereReponse: request.Response | undefined
    for (let i = 0; i < 3; i++) {
      derniereReponse = await api
        .get('/rate-limit/a')
        .set('authorization', unHeaderAuthorization())
      statuts.push(derniereReponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 429])
    expect(Number(derniereReponse!.headers['retry-after'])).to.be.greaterThan(0)
  })

  it('partage le compteur utilisateur entre deux routes', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (const route of ['/rate-limit/a', '/rate-limit/b', '/rate-limit/a']) {
      const reponse = await api
        .get(route)
        .set('authorization', unHeaderAuthorization())
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 429])
  })

  it('limite une route authentifiée par jeton en query param', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (let i = 0; i < 3; i++) {
      const reponse = await api.get('/rate-limit/oidc-query-token?token=jwt')
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 429])
  })

  it('applique la limite INVITE à un invité', async () => {
    // Given
    const api = await demarrerApp({ payload: unJwtPayloadValideInvite() })

    // When
    const statuts = []
    for (let i = 0; i < 2; i++) {
      const reponse = await api
        .get('/rate-limit/a')
        .set('authorization', unHeaderAuthorization())
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 429])
  })

  it("laisse passer un utilisateur dont le type n'a pas de limite", async () => {
    // Given
    const api = await demarrerApp({
      payload: { ...unJwtPayloadValideJeunePE(), userType: undefined }
    })

    // When
    const statuts = []
    for (let i = 0; i < 5; i++) {
      const reponse = await api
        .get('/rate-limit/a')
        .set('authorization', unHeaderAuthorization())
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 200, 200, 200])
  })

  it('limite une route publique par x-real-ip', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (let i = 0; i < 3; i++) {
      const reponse = await api
        .get('/rate-limit/public')
        .set('x-real-ip', '1.1.1.1')
      statuts.push(reponse.status)
    }
    const reponseAutreIp = await api
      .get('/rate-limit/public')
      .set('x-real-ip', '2.2.2.2')
    statuts.push(reponseAutreIp.status)

    // Then
    expect(statuts).to.deep.equal([200, 200, 429, 200])
    expect(logsRateLimitExceeded()).to.deep.equal([
      [
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'ip', rate_limit_palier: '1' },
          url: { path: '/rate-limit/public' },
          client: { ip: '1.1.1.1' }
        },
        'rate_limit_exceeded'
      ]
    ])
  })

  it("ne limite jamais une route en clé d'API", async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (let i = 0; i < 5; i++) {
      const reponse = await api
        .get('/rate-limit/skip-oidc-auth')
        .set('x-real-ip', '1.1.1.1')
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 200, 200, 200])
  })

  it('ne limite jamais /health', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (let i = 0; i < 5; i++) {
      const reponse = await api.get('/health').set('x-real-ip', '1.1.1.1')
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 200, 200, 200])
  })

  it('applique la limite route-couteuse en plus de la limite utilisateur', async () => {
    // Given
    const api = await demarrerApp()

    // When
    const statuts = []
    for (let i = 0; i < 2; i++) {
      const reponse = await api
        .post('/rate-limit/couteuse')
        .set('authorization', unHeaderAuthorization())
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([201, 429])
    expect(logsRateLimitExceeded()).to.deep.equal([
      [
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'route-couteuse', rate_limit_palier: '1' },
          url: { path: '/rate-limit/couteuse' }
        },
        'rate_limit_exceeded'
      ]
    ])
  })

  it("laisse tout passer quand RATE_LIMIT_ACTIF n'est pas posé", async () => {
    // Given
    const stockage = new StockageEnFenetreFixe()
    const incrementer = sandbox.spy(stockage, 'increment')
    const api = await demarrerApp({
      rateLimit: { ...uneConfigRateLimit(), actif: false },
      stockage
    })

    // When
    const statuts = []
    for (let i = 0; i < 5; i++) {
      const reponse = await api
        .get('/rate-limit/a')
        .set('authorization', unHeaderAuthorization())
      statuts.push(reponse.status)
    }

    // Then
    expect(statuts).to.deep.equal([200, 200, 200, 200, 200])
    expect(incrementer).not.to.have.been.called()
  })

  it('laisse passer la requête quand le stockage lève une erreur', async () => {
    // Given
    const api = await demarrerApp({ stockage: new StockageEnPanne() })

    // When
    const reponse = await api
      .get('/rate-limit/a')
      .set('authorization', unHeaderAuthorization())

    // Then
    expect(reponse.status).to.equal(200)
  })

  it('logue rate_limit_exceeded au 1er et au 10e refus seulement', async () => {
    // Given
    const api = await demarrerApp({
      rateLimit: uneConfigRateLimit({ JEUNE: 1 })
    })

    // When
    for (let i = 0; i < 12; i++) {
      await api
        .get('/rate-limit/a')
        .set('authorization', unHeaderAuthorization())
    }

    // Then
    expect(logsRateLimitExceeded()).to.deep.equal([
      [
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'utilisateur', rate_limit_palier: '1' },
          url: { path: '/rate-limit/a' }
        },
        'rate_limit_exceeded'
      ],
      [
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'utilisateur', rate_limit_palier: '10' },
          url: { path: '/rate-limit/a' }
        },
        'rate_limit_exceeded'
      ]
    ])
  })
})

describe('RateLimitGuard dans AppModule', () => {
  it("passe après OidcAuthGuard, pour lire l'utilisateur authentifié", () => {
    // When
    const guardsGlobaux = buildModuleMetadata()
      .providers!.filter(
        (provider): provider is ClassProvider =>
          typeof provider === 'object' &&
          'provide' in provider &&
          provider.provide === APP_GUARD
      )
      .map(provider => provider.useClass)

    // Then
    expect(guardsGlobaux.indexOf(RateLimitGuard)).to.be.greaterThan(
      guardsGlobaux.indexOf(OidcAuthGuard)
    )
  })
})

describe('estUnPalierDeRefus', () => {
  for (const refus of [1, 10, 100, 1000]) {
    it(`renvoie true pour ${refus}`, () => {
      expect(estUnPalierDeRefus(refus)).to.be.true()
    })
  }

  for (const refus of [0, 2, 11, 99, -1]) {
    it(`renvoie false pour ${refus}`, () => {
      expect(estUnPalierDeRefus(refus)).to.be.false()
    })
  }
})

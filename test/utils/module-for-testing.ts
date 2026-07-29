import { HttpModule } from '@nestjs/axios'
import {
  INestApplication,
  Provider,
  Type,
  ValidationPipe
} from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TerminusModule } from '@nestjs/terminus'
import { Test, TestingModuleBuilder } from '@nestjs/testing'
import { TokenMessage } from 'firebase-admin/messaging'
import { JWTPayload } from 'jose'
import { createSandbox, SinonSandbox } from 'sinon'
import {
  buildModuleMetadata,
  buildQueryCommandsProviders
} from 'src/app.module'
import { Authentification } from 'src/domain/authentification'
import { IJwtService, JwtService } from 'src/infrastructure/auth/jwt.service'
import { OidcAuthGuard } from 'src/infrastructure/auth/oidc.auth-guard'
import { FirebaseClient } from 'src/infrastructure/clients/firebase-client'
import { DateService } from 'src/utils/date-service'
import { configureLoggerModule } from 'src/utils/logger.module'
import { unJwtPayloadValide } from '../fixtures/authentification.fixture'
import { uneDatetime } from '../fixtures/date.fixture'
import { FakeController } from '../infrastructure/auth/fake.controller'
import { stubClass, stubClassSandbox } from './types'
import { PlanificateurRepositoryToken } from '../../src/domain/planificateur'
import { PlanificateurRedisRepository } from '../../src/infrastructure/repositories/planificateur-redis.repository.db'
import { OidcClient } from '../../src/infrastructure/clients/oidc-client.db'

export function buildTestingModuleForHttpTesting(
  sandbox: SinonSandbox = createSandbox()
): TestingModuleBuilder {
  const moduleMetadata = buildModuleMetadata()
  return Test.createTestingModule({
    imports: [
      HttpModule,
      ConfigModule.forRoot(),
      TerminusModule,
      configureLoggerModule()
    ],
    providers: stubProviders(sandbox),
    controllers: [...moduleMetadata.controllers!, FakeController]
  })
}
export function buildTestingModuleForEndToEndTesting(): TestingModuleBuilder {
  const moduleMetadata = buildModuleMetadata()
  return Test.createTestingModule({
    imports: [
      HttpModule,
      ConfigModule.forRoot(),
      TerminusModule,
      configureLoggerModule()
    ],
    providers: [...moduleMetadata.providers!],
    controllers: [...moduleMetadata.controllers!, FakeController]
  })
}

let applicationForHttpTesting: INestApplication
let sandbox: SinonSandbox

export const getApplicationWithStubbedDependencies =
  async (): Promise<INestApplication> => {
    if (!applicationForHttpTesting) {
      sandbox = createSandbox()
      const testingModule = await buildTestingModuleForHttpTesting(sandbox)
        .overrideProvider(JwtService)
        .useClass(FakeJwtService)
        .compile()

      applicationForHttpTesting = testingModule.createNestApplication()
      applicationForHttpTesting.useGlobalPipes(
        new ValidationPipe({ whitelist: true })
      )
      await applicationForHttpTesting.init()
    }

    afterEach(() => {
      sandbox.reset()
    })
    return applicationForHttpTesting
  }

import { testConfig } from './test-config'
export { testConfig }

const stubProviders = (sandbox: SinonSandbox): Provider[] => {
  const dateService = stubClass(DateService)
  dateService.now.returns(uneDatetime())
  const jwtService = stubClass(JwtService)
  jwtService.verifyTokenAndGetJwt.resolves(unJwtPayloadValide())
  const providers: Provider[] = [
    {
      provide: JwtService,
      useValue: jwtService
    },
    {
      provide: APP_GUARD,
      useClass: OidcAuthGuard
    },
    {
      provide: FirebaseClient,
      useClass: FakeFirebaseClient
    },
    {
      provide: ConfigService,
      useValue: testConfig()
    },
    {
      provide: DateService,
      useValue: dateService
    },
    {
      provide: PlanificateurRepositoryToken,
      useClass: PlanificateurRedisRepository
    },
    {
      provide: OidcClient,
      useValue: stubClassSandbox(OidcClient, sandbox)
    }
  ]
  const queryCommandsProviders = buildQueryCommandsProviders().map(
    (provider: Provider): Provider => {
      return {
        provide: provider as Type,
        useValue: stubClassSandbox(provider as Type, sandbox)
      }
    }
  )
  return providers.concat(queryCommandsProviders)
}

export class FakeJwtService implements IJwtService {
  private valid: boolean
  private payload: JWTPayload

  constructor(valid = true, payload: JWTPayload = unJwtPayloadValide()) {
    this.valid = valid
    this.payload = payload
  }

  async verifyTokenAndGetJwt(_token: string): Promise<JWTPayload> {
    if (this.valid) {
      return this.payload
    }
    throw new Error('JWT invalid')
  }
}

class FakeFirebaseClient {
  getToken(_utilisateur: Authentification.Utilisateur): Promise<string> {
    return Promise.resolve('un-pushNotificationToken-firebase')
  }

  initializeChatIfNotExists(
    _jeuneId: string,
    _conseillerId: string
  ): Promise<void> {
    return Promise.resolve(undefined)
  }

  send(_tokenMessage: TokenMessage): Promise<void> {
    return Promise.resolve(undefined)
  }
}

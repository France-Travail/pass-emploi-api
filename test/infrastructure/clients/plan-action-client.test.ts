import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as nock from 'nock'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { ProfileDto } from '../../../src/infrastructure/clients/dto/plan-action.dto'
import { PlanActionClient } from '../../../src/infrastructure/clients/plan-action-client'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/test-config'

describe('PlanActionClient', () => {
  let planActionClient: PlanActionClient
  const configService = testConfig()
  const apiUrl = configService.get('planAction').url
  const apiKey = configService.get('planAction').apiKey

  const profile: ProfileDto = {
    authProvider: 'guest',
    situation: 'high-school',
    goals: ['apprenticeship'],
    obstacles: ['transport'],
    domain: 'mécanique',
    location: { city: 'Rouen', radiusKm: 30, territory: '76' }
  }

  // nock compare le corps *sérialisé* : on lui passe l'objet JSON plutôt que le
  // DTO typé, dont l'interface fermée ne satisfait pas RequestBodyMatcher.
  function corpsJson(corps: unknown): nock.DataMatcherMap {
    return JSON.parse(JSON.stringify(corps))
  }

  beforeEach(async () => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    planActionClient = new PlanActionClient(configService, externalApiLogger)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('genererPlan', () => {
    it('renvoie le plan renvoyé par le service, avec le bon en-tête', async () => {
      // Given
      const plan = {
        id: 'plan-1',
        greeting: 'Salut !',
        objectives: [],
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'fallback' as const
      }

      nock(apiUrl, {
        reqheaders: { authorization: `Bearer ${apiKey}` }
      })
        .post('/v1/action-plans', corpsJson({ profile }))
        .reply(201, { plan })

      // When
      const result = await planActionClient.genererPlan(profile)

      // Then
      expect(result).to.deep.equal(success(plan))
    })

    it('envoie le modèle configuré quand il est renseigné', async () => {
      // Given
      const externalApiLogger = stubClass(ExternalApiLoggerService)
      externalApiLogger.createAxios.returns(axios.create())
      const configAvecModele = new ConfigService({
        planAction: {
          url: apiUrl,
          apiKey,
          timeoutMs: 15000,
          modele: 'gemini-3.5-flash'
        }
      })
      const client = new PlanActionClient(configAvecModele, externalApiLogger)
      const plan = {
        id: 'plan-1',
        greeting: 'Salut !',
        objectives: [],
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'llm' as const,
        model: 'gemini-3.5-flash'
      }

      nock(apiUrl)
        .post(
          '/v1/action-plans',
          corpsJson({ profile, model: 'gemini-3.5-flash' })
        )
        .reply(201, { plan })

      // When
      const result = await client.genererPlan(profile)

      // Then
      expect(result).to.deep.equal(success(plan))
    })

    it('renvoie une 502 quand le service refuse le profil (400)', async () => {
      // Given
      nock(apiUrl)
        .post('/v1/action-plans')
        .reply(400, { message: 'Invalid request body' })

      // When
      const result = await planActionClient.genererPlan(profile)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it('renvoie une 502 quand le service est en erreur (500)', async () => {
      // Given
      nock(apiUrl).post('/v1/action-plans').reply(500)

      // When
      const result = await planActionClient.genererPlan(profile)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it('renvoie une 504 quand le service ne répond pas dans le délai imparti', async () => {
      // Given
      const externalApiLogger = stubClass(ExternalApiLoggerService)
      externalApiLogger.createAxios.returns(axios.create())
      const configAvecTimeoutCourt = new ConfigService({
        planAction: { url: apiUrl, apiKey, timeoutMs: 10 }
      })
      const client = new PlanActionClient(
        configAvecTimeoutCourt,
        externalApiLogger
      )

      nock(apiUrl).post('/v1/action-plans').delay(50).reply(201, { plan: {} })

      // When
      const result = await client.genererPlan(profile)

      // Then
      expect(result).to.deep.equal(
        failure(
          new ErreurHttp(
            "Le service de génération du plan d'action n'a pas répondu à temps",
            504
          )
        )
      )
    })
  })
})

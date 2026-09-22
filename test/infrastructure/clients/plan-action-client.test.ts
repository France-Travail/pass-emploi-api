import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import * as nock from 'nock'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import {
  failure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { Profil } from '../../../src/domain/profil'
import { PlanDto } from '../../../src/infrastructure/clients/dto/plan-action.dto'
import { toSuggestion } from '../../../src/infrastructure/clients/mappers/plan-action-poc.mapper'
import { PlanActionClient } from '../../../src/infrastructure/clients/plan-action-client'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/test-config'

describe('PlanActionClient', () => {
  let planActionClient: PlanActionClient
  const configService = testConfig()
  const apiUrl = configService.get('planAction').url
  const apiKey = configService.get('planAction').apiKey

  const unProfil: PlanAction.Profil = {
    structure: Profil.Structure.INVITE,
    situation: 'LYCEE',
    besoins: [PlanAction.Besoin.ALTERNANCE],
    contraintes: [PlanAction.Contrainte.PAS_DE_TRANSPORT],
    domaine: 'mécanique',
    villeRecherche: { codeInsee: '76540', nom: 'Rouen' },
    rayonKm: 30
  }

  const profileDtoAttendu = {
    authProvider: 'guest',
    situation: 'LYCEE',
    goals: ['ALTERNANCE'],
    obstacles: ['PAS_DE_TRANSPORT'],
    domaine: 'mécanique',
    villeRecherche: { codeInsee: '76540', nom: 'Rouen' },
    rayonKm: 30
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
    it('renvoie la suggestion renvoyée par le service, réduite aux identifiants de solution', async () => {
      // Given
      const plan: PlanDto = {
        id: 'plan-1',
        greeting: 'Salut !',
        objectives: [
          {
            id: 'obj-1',
            title: 'Trouver une alternance',
            theme: 'apprenticeship',
            actions: [{ id: 'p-2', label: 'ignoré', kind: 'link', done: false }]
          }
        ],
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'fallback'
      }

      nock(apiUrl, {
        reqheaders: { authorization: `Bearer ${apiKey}` }
      })
        .post('/v1/action-plans', corpsJson({ profile: profileDtoAttendu }))
        .reply(201, { plan })

      // When
      const result = await planActionClient.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(success(toSuggestion(plan)))
      if (isSuccess(result)) {
        expect(result.data.objectifs[0].idsSolutions).to.deep.equal(['p-2'])
        expect(result.data.objectifs[0].titre).to.equal(
          'Trouver une alternance'
        )
      }
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
      const plan: PlanDto = {
        id: 'plan-1',
        greeting: 'Salut !',
        objectives: [],
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'llm',
        model: 'gemini-3.5-flash'
      }

      nock(apiUrl)
        .post(
          '/v1/action-plans',
          corpsJson({ profile: profileDtoAttendu, model: 'gemini-3.5-flash' })
        )
        .reply(201, { plan })

      // When
      const result = await client.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(success(toSuggestion(plan)))
    })

    it('renvoie une 502 quand le service refuse le profil (400)', async () => {
      // Given
      nock(apiUrl)
        .post('/v1/action-plans')
        .reply(400, { message: 'Invalid request body' })

      // When
      const result = await planActionClient.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it('renvoie une 502 quand le service est en erreur (500)', async () => {
      // Given
      nock(apiUrl).post('/v1/action-plans').reply(500)

      // When
      const result = await planActionClient.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it('renvoie une 502 quand le service répond sans plan', async () => {
      // Given
      nock(apiUrl).post('/v1/action-plans').reply(201, {})

      // When
      const result = await planActionClient.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it("renvoie une 502 quand le plan n'a pas de tableau objectives", async () => {
      // Given
      nock(apiUrl)
        .post('/v1/action-plans')
        .reply(201, { plan: { id: 'plan-1' } })

      // When
      const result = await planActionClient.genererPlan(unProfil)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )
    })

    it("renvoie une 502 quand un objective n'a pas de tableau actions", async () => {
      // Given
      nock(apiUrl)
        .post('/v1/action-plans')
        .reply(201, {
          plan: {
            id: 'plan-1',
            greeting: 'Salut !',
            objectives: [{ id: 'obj-1', title: 'Titre', theme: 'Theme' }],
            generatedAt: '2026-07-20T22:03:52.448Z',
            generator: 'fallback'
          }
        })

      // When
      const result = await planActionClient.genererPlan(unProfil)

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
      const result = await client.genererPlan(unProfil)

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

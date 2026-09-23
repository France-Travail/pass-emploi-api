import axios from 'axios'
import * as nock from 'nock'
import { isFailure, isSuccess } from '../../../src/building-blocks/types/result'
import { GristClient } from '../../../src/infrastructure/clients/grist-client'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/test-config'

describe('GristClient', () => {
  let client: GristClient
  const config = testConfig()
  const grist = config.get('grist')

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())

    client = new GristClient(config, externalApiLogger)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('recupererServices', () => {
    it('rend les enregistrements de la table Services', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .matchHeader('authorization', `Bearer ${grist.apiKey}`)
        .reply(200, {
          records: [{ id: 1, fields: { Nom: 'ONISEP', Description: 'site' } }]
        })

      // When
      const result = await client.recupererServices()

      // Then
      expect(isSuccess(result)).to.equal(true)
      if (isSuccess(result)) {
        expect(result.data).to.deep.equal([
          { id: 1, fields: { Nom: 'ONISEP', Description: 'site' } }
        ])
      }
    })

    it('rend un échec quand Grist répond en erreur', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .matchHeader('authorization', `Bearer ${grist.apiKey}`)
        .reply(401)

      // When
      const result = await client.recupererServices()

      // Then
      expect(isFailure(result)).to.equal(true)
    })

    it('rend un échec quand la réponse ne porte pas de records', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .matchHeader('authorization', `Bearer ${grist.apiKey}`)
        .reply(200, { erreur: 'Table not found' })

      // When
      const result = await client.recupererServices()

      // Then
      expect(isFailure(result)).to.equal(true)
    })
  })

  describe('recupererSolutions', () => {
    it('rend les enregistrements de la table Solutions', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableSolutions}/records`)
        .matchHeader('authorization', `Bearer ${grist.apiKey}`)
        .reply(200, { records: [{ id: 1, fields: { Id_technique: 'p-2' } }] })

      // When
      const result = await client.recupererSolutions()

      // Then
      expect(isSuccess(result)).to.equal(true)
    })
  })
})

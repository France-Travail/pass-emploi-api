import axios from 'axios'
import { expect } from 'chai'
import * as nock from 'nock'
import { testConfig } from '../../utils/test-config'
import { ImmersionClient } from '../../../src/infrastructure/clients/immersion-client'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { stubClass } from '../../utils'

describe('ImmersionClient', () => {
  let immersionClient: ImmersionClient
  const configService = testConfig()

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    immersionClient = new ImmersionClient(configService, externalApiLogger)
  })
  describe('get', () => {
    it('fait un http get avec les bons paramètres', async () => {
      // Given
      const resultats = [
        {
          id: 'unId',
          title: 'unTitre',
          startAt: '2022-02-17T10:00:00.000Z',
          domain: 'Informatique',
          city: 'paris'
        }
      ]
      nock('https://api.api-immersion.beta.gouv.op')
        .get('/v3/offers/siret/appellationCode')
        .reply(200, {
          resultats
        })
        .isDone()

      // When
      const response = await immersionClient.get(
        'v3/offers/siret/appellationCode'
      )

      // Then
      expect(response.status).to.equal(200)
      expect(response.data).to.deep.equal({ resultats })
    })
  })
})

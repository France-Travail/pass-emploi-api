import axios from 'axios'
import { expect } from 'chai'
import * as nock from 'nock'
import { isFailure, success } from '../../../src/building-blocks/types/result'
import { ApprentissageClient } from '../../../src/infrastructure/clients/apprentissage-client'
import { CommuneApprentissageDto } from '../../../src/infrastructure/clients/dto/apprentissage.dto'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { stubClass } from '../../utils'
import { testConfig } from '../../utils/test-config'

describe('ApprentissageClient', () => {
  let apprentissageClient: ApprentissageClient
  const configService = testConfig()

  const communeToulouse: CommuneApprentissageDto = {
    nom: 'Toulouse',
    code: { insee: '31555', postaux: ['31000'] },
    mission_locale: {
      nom: 'Mission locale de Toulouse',
      localisation: {
        adresse: '1 rue de la Paix',
        cp: '31000',
        ville: 'Toulouse'
      },
      contact: { telephone: '0561000000' }
    }
  }

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    apprentissageClient = new ApprentissageClient(
      configService,
      externalApiLogger
    )
  })

  describe('rechercherCommunes', () => {
    it('recherche les communes par code postal avec la clé en Bearer', async () => {
      // Given
      nock('https://api.apprentissage.test')
        .get('/geographie/v1/commune/search')
        .query({ code: '31000' })
        .matchHeader('authorization', 'Bearer apprentissage-api-key')
        .reply(200, [communeToulouse])

      // When
      const result = await apprentissageClient.rechercherCommunes('31000')

      // Then
      expect(result).to.deep.equal(success([communeToulouse]))
    })

    it('renvoie une liste vide quand aucune commune ne correspond', async () => {
      // Given
      nock('https://api.apprentissage.test')
        .get('/geographie/v1/commune/search')
        .query({ code: '00000' })
        .reply(200, [])

      // When
      const result = await apprentissageClient.rechercherCommunes('00000')

      // Then
      expect(result).to.deep.equal(success([]))
    })

    it("remonte un échec quand l'API refuse la requête", async () => {
      // Given
      nock('https://api.apprentissage.test')
        .get('/geographie/v1/commune/search')
        .query({ code: '31000' })
        .reply(401)

      // When
      const result = await apprentissageClient.rechercherCommunes('31000')

      // Then
      expect(isFailure(result)).to.equal(true)
    })

    it("lève une erreur quand l'API est en panne", async () => {
      // Given
      nock('https://api.apprentissage.test')
        .get('/geographie/v1/commune/search')
        .query({ code: '31000' })
        .reply(500)

      // When
      const promise = apprentissageClient.rechercherCommunes('31000')

      // Then
      await expect(promise).to.be.rejectedWith(Error)
    })
  })
})

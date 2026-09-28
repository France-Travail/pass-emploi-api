import axios, { AxiosError, AxiosResponse } from 'axios'
import { ErreurMiloHttp } from 'src/building-blocks/types/domain-error'
import { failure } from 'src/building-blocks/types/result'
import {
  ErreurMiloReponseInvalide,
  MiloClientUtils
} from 'src/infrastructure/clients/milo/milo-client-utils'
import { ExternalApiLoggerService } from 'src/utils/external-api-logger.service'
import { testConfig } from 'test/utils/module-for-testing'
import { expect, stubClass } from 'test/utils'

describe('MiloClientUtils', () => {
  let miloClientUtils: MiloClientUtils

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    miloClientUtils = new MiloClientUtils(testConfig(), externalApiLogger)
  })

  describe('handleAxiosError', () => {
    it('convertit une erreur Axios 4xx en failure ErreurMiloHttp', () => {
      // Given
      const erreurAxios = new AxiosError(
        'Request failed with status code 404',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 404,
          data: { message: 'Dossier introuvable', code: 'SUE_NOT_FOUND' }
        } as AxiosResponse
      )

      // When
      const result = miloClientUtils.handleAxiosError(erreurAxios, 'Erreur GET')

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurMiloHttp('Dossier introuvable', 404, 'SUE_NOT_FOUND'))
      )
    })

    it('relance une erreur Axios 5xx', () => {
      // Given
      const erreurAxios = new AxiosError(
        'Request failed with status code 503',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 503, data: {} } as AxiosResponse
      )

      // When / Then
      expect(() =>
        miloClientUtils.handleAxiosError(erreurAxios, 'Erreur GET')
      ).to.throw(erreurAxios)
    })

    it('relance telle quelle une erreur qui ne vient pas d’Axios', () => {
      // Given
      const erreur = new ErreurMiloReponseInvalide(
        'api-evenements/events',
        'text/html'
      )

      // When / Then
      expect(() =>
        miloClientUtils.handleAxiosError(erreur, 'Erreur GET')
      ).to.throw(erreur)
    })
  })
})

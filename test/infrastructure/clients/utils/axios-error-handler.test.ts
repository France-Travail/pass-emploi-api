import { AxiosError } from 'axios'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import { failure } from '../../../../src/building-blocks/types/result'
import { handleAxiosError } from '../../../../src/infrastructure/clients/utils/axios-error-handler'
import { expect } from '../../../utils'

describe('handleAxiosError', () => {
  describe("quand c'est une erreur Axios", () => {
    describe("quand c'est un `status` qu'on gère", () => {
      it('retourne une ErreurHttp', async () => {
        // Given
        const error = {
          response: { status: 429 }
        } as AxiosError

        // When
        const result = handleAxiosError(error, "un message si c'est Axios")

        // Then
        expect(result).to.deep.equal(
          failure(new ErreurHttp("un message si c'est Axios", 429))
        )
      })
    })
    describe("quand c'est un `status` qu'on ne gère pas", () => {
      it('throw une failure', async () => {
        // Given
        const error = {
          response: { status: 503 }
        } as AxiosError

        try {
          // When
          handleAxiosError(error, "un message si c'est Axios")
          expect.fail(null, null, 'handle test did not reject with an error')
        } catch (e) {
          // Then
          expect(e).deep.equal(error)
        }
      })
    })
  })
  describe("quand ce n'est pas une erreur Axios", () => {
    it('throw une failure', async () => {
      // Given
      const error = new Error('une erreur inconnue')

      try {
        // When
        handleAxiosError(error as AxiosError, "un message si c'est Axios")
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (e) {
        // Then
        expect(e).deep.equal(error)
      }
    })
  })
})

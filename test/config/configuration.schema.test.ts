import { configurationSchema } from '../../src/config/configuration.schema'
import { expect } from '../utils'

describe('configurationSchema', () => {
  describe('chatMockUrl', () => {
    function erreursSurChatMockUrl(environment: string): string[] {
      const { error } = configurationSchema.validate(
        { environment, chatMockUrl: 'https://mock-externes.fr/chat' },
        { abortEarly: false }
      )
      return (error?.details ?? [])
        .filter(detail => detail.path[0] === 'chatMockUrl')
        .map(detail => detail.message)
    }

    it('est refusée en prod', () => {
      // When
      const erreurs = erreursSurChatMockUrl('prod')

      // Then
      expect(erreurs).to.have.length(1)
    })

    it('est acceptée hors prod', () => {
      // When
      const erreurs = erreursSurChatMockUrl('perf')

      // Then
      expect(erreurs).to.deep.equal([])
    })
  })
})

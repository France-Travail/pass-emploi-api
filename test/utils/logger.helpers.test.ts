import {
  NonTraitableError,
  NonTraitableReason,
  NonTrouveError
} from '../../src/building-blocks/types/domain-error'
import { toEcsError } from '../../src/utils/logger.helpers'
import { expect } from './index'

describe('logger.helpers', () => {
  describe('toEcsError', () => {
    it('convertit une Error JS', () => {
      // When
      const result = toEcsError(new TypeError('boom'))

      // Then
      expect(result.type).to.equal('TypeError')
      expect(result.message).to.equal('boom')
      expect(result.stack_trace).to.be.a('string')
    })

    it('convertit un DomainError sans reason', () => {
      expect(toEcsError(new NonTrouveError('Jeune', 'id'))).to.deep.equal({
        type: 'NON_TROUVE',
        message: 'Jeune id non trouvé(e)'
      })
    })

    it('porte le reason d’un DomainError qui en a un', () => {
      // When
      const result = toEcsError(
        new NonTraitableError(
          'Utilisateur',
          'sub',
          NonTraitableReason.MIGRATION_PARCOURS_EMPLOI,
          'a@b.fr'
        )
      )

      // Then
      expect(result).to.deep.equal({
        type: 'NON_TRAITABLE',
        message: 'Utilisateur sub non traitable',
        reason: 'MIGRATION_PARCOURS_EMPLOI'
      })
    })

    it('convertit une valeur inconnue', () => {
      expect(toEcsError('oops')).to.deep.equal({
        type: 'Unknown',
        message: 'oops'
      })
    })
  })
})

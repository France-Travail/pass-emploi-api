import { ValidationError } from '@nestjs/common'
import {
  NonTraitableError,
  NonTraitableReason,
  NonTrouveError
} from '../../src/building-blocks/types/domain-error'
import {
  aplatirErreursDeValidation,
  serializeBodyForLog,
  toEcsError
} from '../../src/utils/logger.helpers'
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

    it("convertit l'erreur d'un SuiviJob, objet { message, stack } sans classe Error", () => {
      expect(
        toEcsError({
          message: 'La lecture du référentiel Grist a échoué : timeout',
          stack: 'Error: timeout\n    at GristClient.recupererTable'
        })
      ).to.deep.equal({
        type: 'Error',
        message: 'La lecture du référentiel Grist a échoué : timeout',
        stack_trace: 'Error: timeout\n    at GristClient.recupererTable'
      })
    })

    it("omet stack_trace quand l'erreur d'un SuiviJob n'a pas de stack", () => {
      expect(
        toEcsError({ message: 'Aucune solution exploitable' })
      ).to.deep.equal({ type: 'Error', message: 'Aucune solution exploitable' })
    })

    it('convertit une valeur inconnue', () => {
      expect(toEcsError('oops')).to.deep.equal({
        type: 'Unknown',
        message: 'oops'
      })
    })
  })

  describe('serializeBodyForLog', () => {
    it('masque un jeton nommé en français', () => {
      // When
      const body = serializeBodyForLog({
        jetonConnecte: 'eyJ.secret.jwt',
        plan: { id: 'id-plan' }
      })

      // Then
      expect(body).to.equal(
        '{"jetonConnecte":"[Redacted]","plan":{"id":"id-plan"}}'
      )
    })
  })

  describe('aplatirErreursDeValidation', () => {
    it('remonte chaque contrainte avec son chemin, y compris sur un nœud qui a des enfants', () => {
      // Given
      const erreurs: ValidationError[] = [
        {
          property: 'plan',
          children: [
            {
              property: 'objectives',
              constraints: {
                arrayMaxSize: 'objectives must contain no more than 80 elements'
              },
              children: [
                {
                  property: '0',
                  children: [
                    {
                      property: 'titre',
                      constraints: { isNotEmpty: 'titre should not be empty' },
                      children: []
                    }
                  ]
                }
              ]
            },
            {
              property: 'id',
              constraints: { isUuid: 'id must be a UUID' },
              children: []
            }
          ]
        }
      ]

      // When
      const aplaties = aplatirErreursDeValidation(erreurs)

      // Then
      expect(aplaties).to.deep.equal([
        {
          property: 'plan.objectives',
          constraints: {
            arrayMaxSize: 'objectives must contain no more than 80 elements'
          }
        },
        {
          property: 'plan.objectives.0.titre',
          constraints: { isNotEmpty: 'titre should not be empty' }
        },
        {
          property: 'plan.id',
          constraints: { isUuid: 'id must be a UUID' }
        }
      ])
    })
  })
})

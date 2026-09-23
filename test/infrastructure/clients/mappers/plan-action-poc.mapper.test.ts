import { DateTime } from 'luxon'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Profil } from 'src/domain/profil'
import { PlanDto } from 'src/infrastructure/clients/dto/plan-action.dto'
import {
  toProfileDto,
  toSuggestion
} from 'src/infrastructure/clients/mappers/plan-action-poc.mapper'
import { expect } from 'test/utils'

describe('plan-action-poc.mapper', () => {
  describe('toSuggestion', () => {
    const planDto: PlanDto = {
      id: 'plan-poc-1',
      greeting: 'Bonjour Camille',
      generatedAt: '2026-09-22T10:00:00.000Z',
      generator: 'llm',
      objectives: [
        {
          id: 'obj-poc-1',
          title: 'Trouver une alternance',
          theme: 'apprenticeship',
          actions: [
            {
              id: 'p-2',
              label: 'ignoré',
              kind: 'link',
              done: false
            },
            {
              id: 'p-7',
              label: 'ignoré aussi',
              kind: 'advice',
              done: false
            }
          ]
        }
      ]
    }

    it('ne retient que les identifiants de solution, jamais le contenu', () => {
      // When
      const suggestion = toSuggestion(planDto)

      // Then
      expect(suggestion.objectifs).to.deep.equal([
        {
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          idsSolutions: ['p-2', 'p-7']
        }
      ])
    })

    it("reporte l'accroche, la date et le générateur", () => {
      // When
      const suggestion = toSuggestion(planDto)

      // Then
      expect(suggestion.accroche).to.equal('Bonjour Camille')
      expect(suggestion.generateur).to.equal('llm')
      expect(suggestion.genereLe.toISO()).to.equal(
        DateTime.fromISO('2026-09-22T10:00:00.000Z', {
          setZone: true
        }).toISO()
      )
    })

    it('conserve le décalage écrit dans la chaîne, sans faire glisser le jour civil', () => {
      // Given
      const planAvecDecalage: PlanDto = {
        ...planDto,
        generatedAt: '2026-07-20T22:03:52.448+02:00'
      }

      // When
      const suggestion = toSuggestion(planAvecDecalage)

      // Then
      expect(suggestion.genereLe.toISO()).to.equal(
        '2026-07-20T22:03:52.448+02:00'
      )
      expect(suggestion.genereLe.day).to.equal(20)
    })
  })

  describe('toProfileDto', () => {
    const profil: PlanAction.Profil = {
      structure: Profil.Structure.MILO,
      situation: 'LYCEE',
      besoins: [PlanAction.Besoin.ALTERNANCE],
      contraintes: [PlanAction.Contrainte.PAS_DE_PERMIS],
      dateNaissance: DateTime.fromISO('2006-03-14T00:00:00.000+02:00', {
        setZone: true
      })
    }

    it('compose le profil attendu par le service', () => {
      // When
      const dto = toProfileDto(profil)

      // Then
      expect(dto.authProvider).to.equal('mission-locale')
      expect(dto.situation).to.equal('LYCEE')
      expect(dto.goals).to.deep.equal(['ALTERNANCE'])
      expect(dto.obstacles).to.deep.equal(['PAS_DE_PERMIS'])
      expect(dto.dateNaissance).to.equal('2006-03-14')
    })

    it('omet la date de naissance quand elle est absente', () => {
      // When
      const dto = toProfileDto({ ...profil, dateNaissance: undefined })

      // Then
      expect(dto.dateNaissance).to.equal(undefined)
    })

    it("ne transmet que RIEN_NE_ME_BLOQUE quand il est combiné à d'autres contraintes", () => {
      // When
      const dto = toProfileDto({
        ...profil,
        contraintes: ['PAS_DE_PERMIS', 'RIEN_NE_ME_BLOQUE', 'FRANCAIS']
      })

      // Then
      expect(dto.obstacles).to.deep.equal(['RIEN_NE_ME_BLOQUE'])
    })

    it('transmet les autres contraintes telles quelles quand RIEN_NE_ME_BLOQUE est absent', () => {
      // When
      const dto = toProfileDto({
        ...profil,
        contraintes: ['PAS_DE_PERMIS', 'AUTRE']
      })

      // Then
      expect(dto.obstacles).to.deep.equal(['PAS_DE_PERMIS', 'AUTRE'])
    })
  })
})

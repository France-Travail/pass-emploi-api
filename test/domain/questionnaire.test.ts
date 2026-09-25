import { DateTime } from 'luxon'
import { Profil } from '../../src/domain/profil'
import { Questionnaire } from '../../src/domain/questionnaire'
import { expect } from '../utils'

function unQuestionnaire(args: Partial<Questionnaire> = {}): Questionnaire {
  return {
    structure: Profil.Structure.INVITE,
    situation: Questionnaire.Situation.LYCEE,
    besoins: [Questionnaire.Besoin.ALTERNANCE],
    contraintes: [],
    ...args
  }
}

describe('Questionnaire', () => {
  describe('calculerContraintes', () => {
    it('rend RIEN_NE_ME_BLOQUE exclusif quand il est combiné à une autre contrainte', () => {
      // When
      const contraintes = Questionnaire.calculerContraintes([
        Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE,
        Questionnaire.Contrainte.PAS_DE_TRANSPORT
      ])

      // Then
      expect(contraintes).to.deep.equal([
        Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE
      ])
    })

    it('dédoublonne les contraintes', () => {
      // When
      const contraintes = Questionnaire.calculerContraintes([
        Questionnaire.Contrainte.PAS_DE_TRANSPORT,
        Questionnaire.Contrainte.PAS_DE_TRANSPORT
      ])

      // Then
      expect(contraintes).to.deep.equal([
        Questionnaire.Contrainte.PAS_DE_TRANSPORT
      ])
    })
  })

  describe('calculerAge', () => {
    const maintenant = DateTime.fromISO('2026-08-27T10:00:00.000Z', {
      zone: 'utc'
    })

    it("compte l'anniversaire du jour comme âge atteint", () => {
      // When
      const age = Questionnaire.calculerAge(
        unQuestionnaire({ dateNaissance: DateTime.fromISO('2008-08-27') }),
        maintenant
      )

      // Then
      expect(age).to.equal(18)
    })

    it('ne calcule rien sans date de naissance', () => {
      // When
      const age = Questionnaire.calculerAge(unQuestionnaire(), maintenant)

      // Then
      expect(age).to.equal(undefined)
    })
  })

  describe('calculerDepartement', () => {
    it('prend la ville de recherche en priorité sur la commune de résidence', () => {
      // When
      const departement = Questionnaire.calculerDepartement(
        unQuestionnaire({
          communeResidence: { codeInsee: '76540', nom: 'Rouen' },
          communeRecherche: { codeInsee: '75101', nom: 'Paris 1er' }
        })
      )

      // Then
      expect(departement).to.equal('75')
    })

    it("garde trois caractères pour l'outre-mer", () => {
      // When
      const departement = Questionnaire.calculerDepartement(
        unQuestionnaire({
          communeResidence: { codeInsee: '97209', nom: 'Fort-de-France' }
        })
      )

      // Then
      expect(departement).to.equal('972')
    })

    it('ne calcule rien sans commune', () => {
      // When
      const departement = Questionnaire.calculerDepartement(unQuestionnaire())

      // Then
      expect(departement).to.equal(undefined)
    })
  })
})

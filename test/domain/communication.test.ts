import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../src/building-blocks/types/domain-error'
import { isFailure, isSuccess } from '../../src/building-blocks/types/result'
import { Communication } from '../../src/domain/communication'
import { expect } from '../utils'

describe('Communication', () => {
  const aCreer: Communication = {
    idPopulation: 'PHASE_C',
    destinataire: Communication.Destinataire.CONSEILLER,
    type: Communication.Type.IN_APP,
    dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z'),
    dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z'),
    titre: 'Votre application évolue',
    contenu:
      'Le 15 octobre 2026, l’application pass emploi ne sera plus disponible.'
  }

  describe('creer', () => {
    it('crée une communication quand la date de début précède la date de fin', () => {
      // When
      const result = Communication.creer(aCreer)

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('refuse une date invalide', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        dateFin: DateTime.fromISO('2026-10-15T24:00:00.000Z')
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une date de fin antérieure ou égale à la date de début', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        dateFin: aCreer.dateDebut
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })
  })
})

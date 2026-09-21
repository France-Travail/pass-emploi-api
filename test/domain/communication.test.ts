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

    it('refuse une date invalide (bien formée pour @IsISO8601, rejetée par le calendrier)', () => {
      // Given
      // "31 avril" n'existe pas : @IsISO8601 (regex) l'accepte, Luxon le rejette.
      const dateFin = DateTime.fromISO('2026-04-31T00:00:00.000Z')

      // When
      const result = Communication.creer({
        ...aCreer,
        dateFin
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

    it('crée une communication IN_APP sans date de fin, visible indéfiniment', () => {
      // When
      const result = Communication.creer({ ...aCreer, dateFin: undefined })

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('crée une communication avec un cta complet', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        ctaLabel: 'Télécharger l’application',
        ctaUrlAndroid: 'https://play.google.com/store/apps/details?id=xxx',
        ctaUrlIos: 'https://apps.apple.com/app/apple-store/id123'
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('refuse un cta avec seulement ctaLabel renseigné', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        ctaLabel: 'Télécharger l’application'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse un cta avec seulement ctaUrlAndroid renseigné', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        ctaUrlAndroid: 'https://play.google.com/store/apps/details?id=xxx'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse un cta avec ctaLabel et ctaUrlAndroid mais sans ctaUrlIos', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        ctaLabel: 'Télécharger l’application',
        ctaUrlAndroid: 'https://play.google.com/store/apps/details?id=xxx'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it("refuse une communication NOTIFICATION tant que l'envoi n'est pas livré", () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        dateFin: undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })
  })
})

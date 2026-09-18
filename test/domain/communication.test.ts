import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../src/building-blocks/types/domain-error'
import { isFailure, isSuccess } from '../../src/building-blocks/types/result'
import { Communication } from '../../src/domain/communication'
import { Notification } from '../../src/domain/notification/notification'
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

    const aCreerNotification: Communication = {
      ...aCreer,
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      titre: 'Courte',
      contenu: 'Court',
      dateFin: undefined
    }

    it('crée une communication NOTIFICATION valide', () => {
      // When
      const result = Communication.creer(aCreerNotification)

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('crée une communication NOTIFICATION sans typeNotification : l’app ne redirige nulle part', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        typeNotification: undefined
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('crée une communication NOTIFICATION avec typeNotification CENTRE_DE_NOTIFS_UNIQUEMENT', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        typeNotification: Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('refuse une communication NOTIFICATION sans push', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        push: undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('crée une communication NOTIFICATION avec push à false', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        push: false
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
    })

    it('refuse une communication NOTIFICATION avec une date de fin : une notification envoyée ne peut pas être rappelée', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z')
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication NOTIFICATION destinée aux conseillers', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        destinataire: Communication.Destinataire.CONSEILLER
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication NOTIFICATION avec un titre de plus de 50 caractères', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        titre: 'x'.repeat(51)
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication NOTIFICATION avec un contenu de plus de 150 caractères', () => {
      // When
      const result = Communication.creer({
        ...aCreerNotification,
        contenu: 'x'.repeat(151)
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication IN_APP avec un typeNotification', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication IN_APP avec un push', () => {
      // When
      const result = Communication.creer({
        ...aCreer,
        push: true
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })
  })
})

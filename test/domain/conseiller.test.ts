import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../src/building-blocks/types/domain-error'
import {
  Failure,
  isFailure,
  isSuccess,
  Success
} from '../../src/building-blocks/types/result'
import { Conseiller } from '../../src/domain/milo/conseiller'
import { unConseiller } from '../fixtures/conseiller.fixture'
import { expect } from '../utils'
import { Profil } from '../../src/domain/profil'

describe('Conseiller', () => {
  describe('mettreAJour', () => {
    describe('conseiller Mission Locale', () => {
      it('n‘autorise pas la mise à jour d‘une agence hors référentiel', async () => {
        // Given
        const conseillerMilo = unConseiller({
          id: 'id-conseiller',
          structure: Profil.Structure.MILO
        })
        const agenceHorsReferentiel: Conseiller.InfosDeMiseAJour = {
          agence: {
            nom: 'une agence, hors référentiel, renseignée manuellement'
          }
        }
        // When
        const result = Conseiller.mettreAJour(
          conseillerMilo,
          agenceHorsReferentiel
        )

        // Then
        expect(isFailure(result)).to.equal(true)
        expect((result as Failure).error).to.be.an.instanceOf(
          MauvaiseCommandeError
        )
      })

      it('n‘autorise pas le choix d‘un dispositif', () => {
        // Given
        const conseillerMilo = unConseiller({
          structure: Profil.Structure.MILO,
          dispositif: null
        })

        // When
        const result = Conseiller.mettreAJour(conseillerMilo, {
          dispositif: Profil.Dispositif.CEJ
        })

        // Then
        expect(isFailure(result)).to.equal(true)
        expect((result as Failure).error).to.be.an.instanceOf(
          MauvaiseCommandeError
        )
      })

      it('n‘autorise pas un conseiller Milo à changer d‘agence', async () => {
        // Given
        const conseillerMilo = unConseiller({
          id: 'id-conseiller',
          structure: Profil.Structure.MILO,
          agence: { id: 'ancienne-agence' }
        })
        const nouvelleAgence: Conseiller.InfosDeMiseAJour = {
          agence: { id: 'nouvelle-agence' }
        }

        // When
        const result = Conseiller.mettreAJour(conseillerMilo, nouvelleAgence)

        // Then
        expect(isFailure(result)).to.equal(true)
        expect((result as Failure).error).to.be.an.instanceOf(
          MauvaiseCommandeError
        )
      })
    })

    describe('conseiller France Travail', () => {
      it('choisit son dispositif', () => {
        // Given
        const conseillerSansDispositif = unConseiller({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: null
        })

        // When
        const result = Conseiller.mettreAJour(conseillerSansDispositif, {
          dispositif: Profil.Dispositif.BRSA
        })

        // Then
        expect(isSuccess(result)).to.equal(true)
        expect((result as Success<Conseiller>).data.dispositif).to.equal(
          Profil.Dispositif.BRSA
        )
      })

      it('conserve son dispositif quand aucun n‘est choisi', () => {
        // Given
        const conseillerCEJ = unConseiller({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        const result = Conseiller.mettreAJour(conseillerCEJ, {
          notificationsSonores: true
        })

        // Then
        expect((result as Success<Conseiller>).data.dispositif).to.equal(
          Profil.Dispositif.CEJ
        )
      })

      it('n‘autorise pas un dispositif hors accompagnement France Travail', () => {
        // Given
        const conseillerFT = unConseiller({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: null
        })

        // When
        const result = Conseiller.mettreAJour(conseillerFT, {
          dispositif: Profil.Dispositif.PACEA
        })

        // Then
        expect(isFailure(result)).to.equal(true)
        expect((result as Failure).error).to.be.an.instanceOf(
          MauvaiseCommandeError
        )
      })

      it('autorise un conseiller France Travail à changer d‘agence', async () => {
        // Given
        const conseillerFT = unConseiller({
          id: 'id-conseiller',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          agence: { id: 'ancienne-agence' }
        })
        const nouvelleAgence: Conseiller.InfosDeMiseAJour = {
          agence: { id: 'nouvelle-agence' }
        }

        // When
        const result = Conseiller.mettreAJour(conseillerFT, nouvelleAgence)

        // Then
        expect(isSuccess(result)).to.equal(true)
        if (isSuccess(result)) {
          expect(result.data.agence).to.deep.equal({ id: 'nouvelle-agence' })
        }
      })

      it('reprend la date de mise a jour d‘agence transmise', async () => {
        // Given
        const conseillerFT = unConseiller({
          id: 'id-conseiller',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          agence: { id: 'ancienne-agence' }
        })
        const maintenant = DateTime.fromISO('2026-09-04T10:00:00.000Z')
        const reconfirmation: Conseiller.InfosDeMiseAJour = {
          agence: { id: 'ancienne-agence' },
          dateMajAgence: maintenant
        }

        // When
        const result = Conseiller.mettreAJour(conseillerFT, reconfirmation)

        // Then
        expect(isSuccess(result)).to.equal(true)
        if (isSuccess(result)) {
          expect(result.data.dateMajAgence).to.deep.equal(maintenant)
        }
      })
    })
  })

  describe('doitChoisirSonDispositif', () => {
    it('est vrai pour un conseiller France Travail sans dispositif', () => {
      expect(
        Conseiller.doitChoisirSonDispositif(
          unConseiller({
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif: null
          })
        )
      ).to.equal(true)
    })

    it('est faux pour un conseiller France Travail avec dispositif', () => {
      expect(
        Conseiller.doitChoisirSonDispositif(
          unConseiller({
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif: Profil.Dispositif.AIJ
          })
        )
      ).to.equal(false)
    })

    it('est faux pour un conseiller Mission Locale ou Conseil départemental', () => {
      expect(
        Conseiller.doitChoisirSonDispositif(
          unConseiller({ structure: Profil.Structure.MILO, dispositif: null })
        )
      ).to.equal(false)
      expect(
        Conseiller.doitChoisirSonDispositif(
          unConseiller({
            structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
            dispositif: null
          })
        )
      ).to.equal(false)
    })
  })
})

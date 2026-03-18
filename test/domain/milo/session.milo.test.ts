import { DateTime } from 'luxon'
import {
  BeneficiaireDejaInscritError,
  DroitsInsuffisants,
  EmargementIncorrect,
  NombrePlacesInsuffisantError
} from 'src/building-blocks/types/domain-error'
import {
  Failure,
  failure,
  isFailure,
  isSuccess
} from 'src/building-blocks/types/result'
import { SessionMilo } from 'src/domain/milo/session.milo'
import { expect } from 'test/utils'
import {
  uneSessionMilo,
  uneSessionMiloAllegee
} from '../../fixtures/sessions.fixture'

describe('SessionMilo', () => {
  describe('calculerStatut', () => {
    const maintenant = DateTime.now()

    describe('quand la date de clôture est renseignée', () => {
      it('retourne le statut CLOTUREE même si la date est postérieure à maintenant', () => {
        // Given
        const date = maintenant.plus({ days: 1 })
        const dateCloture = maintenant.minus({ hours: 1 })

        // When
        const statut = SessionMilo.calculerStatut(
          [],
          maintenant,
          date,
          dateCloture
        )

        // Then
        expect(statut).to.equal(SessionMilo.Statut.CLOTUREE)
      })
    })

    describe('quand la date de clôture n’est pas renseignée', () => {
      const dateCloture = undefined

      it('si la session se termine dans le futur, retourne le statut A_VENIR', () => {
        // Given
        const date = maintenant.plus({ days: 1 })

        // When
        const statut = SessionMilo.calculerStatut(
          [],
          maintenant,
          date,
          dateCloture
        )

        // Then
        expect(statut).to.equal(SessionMilo.Statut.A_VENIR)
      })

      describe('quand la session s’est terminée', () => {
        it('s’il n’y a pas de participant, retourne le statut EMARGEE', () => {
          // Given
          const date = maintenant.minus({ days: 1 })

          // When
          const statut = SessionMilo.calculerStatut(
            [],
            maintenant,
            date,
            dateCloture
          )

          // Then
          expect(statut).to.equal(SessionMilo.Statut.EMARGEE)
        })

        it('s’il y a des participants non émargés, retourne le statut A_CLOTURER', () => {
          // Given
          const date = maintenant.minus({ days: 1 })

          // When
          const statut = SessionMilo.calculerStatut(
            [
              SessionMilo.Inscription.Statut.INSCRIT,
              SessionMilo.Inscription.Statut.REFUS_JEUNE,
              SessionMilo.Inscription.Statut.REFUS_TIERS,
              SessionMilo.Inscription.Statut.PRESENT
            ],
            maintenant,
            date,
            dateCloture
          )

          // Then
          expect(statut).to.equal(SessionMilo.Statut.A_CLOTURER)
        })

        it('si tous les partcipants sont émargés, retourne le statut EMARGEE', () => {
          // Given
          const date = maintenant.minus({ days: 1 })

          // When
          const statut = SessionMilo.calculerStatut(
            [
              SessionMilo.Inscription.Statut.REFUS_JEUNE,
              SessionMilo.Inscription.Statut.REFUS_TIERS,
              SessionMilo.Inscription.Statut.PRESENT
            ],
            maintenant,
            date,
            dateCloture
          )

          // Then
          expect(statut).to.equal(SessionMilo.Statut.EMARGEE)
        })
      })
    })
  })

  describe('emarger', () => {
    const uneDateDEmargement = DateTime.local(2023)
    const uneSessionAvecUneInscription = {
      ...uneSessionMilo(),
      inscriptions: [
        {
          idJeune: 'id-hermione',
          idInscription: 'id-inscription-hermione',
          nom: 'Granger',
          prenom: 'Hermione',
          statut: SessionMilo.Inscription.Statut.INSCRIT
        }
      ]
    }

    it('renvoie une failure si tous les jeunes de la session ne sont pas emargés', () => {
      // When
      const result = SessionMilo.emarger(
        uneSessionMilo(),
        [
          {
            idJeune: 'id-hermione',
            statut: SessionMilo.Inscription.Statut.INSCRIT
          }
        ],
        uneDateDEmargement
      )
      // Then
      expect(result).to.deep.equal(failure(new EmargementIncorrect()))
    })

    it('renvoie un statut REFUS_JEUNE pour les jeunes inscrits mais non présents', async () => {
      assertInsriptionsAModifier(SessionMilo.Inscription.Statut.INSCRIT, [
        {
          idJeune: 'id-hermione',
          idInscription: 'id-inscription-hermione',
          statut: SessionMilo.Inscription.Statut.REFUS_JEUNE,
          commentaire: 'Absent'
        }
      ])
    })

    it('renvoie un statut PRESENT pour les jeunes présents', async () => {
      assertInsriptionsAModifier(SessionMilo.Inscription.Statut.PRESENT, [
        {
          idJeune: 'id-hermione',
          idInscription: 'id-inscription-hermione',
          statut: SessionMilo.Inscription.Statut.PRESENT,
          commentaire: undefined
        }
      ])
    })

    it('ne renvoie pas les jeunes au statut REFUS_JEUNE', async () => {
      assertInsriptionsAModifier(SessionMilo.Inscription.Statut.REFUS_JEUNE, [])
    })

    it('ne renvoie pas les jeunes au statut REFUS_TIERS', async () => {
      assertInsriptionsAModifier(SessionMilo.Inscription.Statut.REFUS_TIERS, [])
    })

    it('renvoie la session avec une date de clôture et la date de modification mise à jour', async () => {
      const result = await SessionMilo.emarger(
        uneSessionAvecUneInscription,
        [
          {
            idJeune: 'id-hermione',
            statut: SessionMilo.Inscription.Statut.PRESENT
          }
        ],
        uneDateDEmargement
      )
      // Then
      expect(isSuccess(result)).to.be.true()
      if (isSuccess(result)) {
        expect(result.data.sessionEmargee).to.deep.equal({
          ...uneSessionAvecUneInscription,
          dateCloture: uneDateDEmargement,
          dateModification: uneDateDEmargement
        })
      }
    })

    function assertInsriptionsAModifier(
      givenStatut: SessionMilo.Inscription.Statut,
      expected: Array<Omit<SessionMilo.Inscription, 'nom' | 'prenom'>>
    ): void {
      // When
      const result = SessionMilo.emarger(
        uneSessionAvecUneInscription,
        [{ idJeune: 'id-hermione', statut: givenStatut }],
        uneDateDEmargement
      )

      // Then
      expect(isSuccess(result)).to.be.true()
      if (isSuccess(result)) {
        expect(result.data.inscriptionsAModifier).to.deep.equal(expected)
      }
    }
  })

  describe('modifier', () => {
    const maintenant = DateTime.now()

    it("désactive l'autoinscription si estVisible est false, même si nouvelleAutoinscription est true", () => {
      // Given
      const session = uneSessionMilo({
        estVisible: false,
        autoinscription: false
      })

      // When
      const result = SessionMilo.modifier(session, maintenant, {
        nouvelleAutoinscription: true
      })

      // Then
      expect(result.estVisible).to.be.false()
      expect(result.autoinscription).to.be.false()
    })

    it("ne change pas la valeur de estVisible quand on désactive l'autoinscription sans visibilité explicite", () => {
      // Given
      const session = uneSessionMilo({
        estVisible: false,
        autoinscription: true
      })

      // When
      const result = SessionMilo.modifier(session, maintenant, {
        nouvelleAutoinscription: false
      })

      // Then
      expect(result.estVisible).to.be.false()
      expect(result.autoinscription).to.be.false()
    })

    it('met à jour estVisible indépendamment quand autoinscription reste inactive', () => {
      // Given
      const session = uneSessionMilo({
        estVisible: false,
        autoinscription: false
      })

      // When
      const result = SessionMilo.modifier(session, maintenant, {
        nouvelleVisibilite: true
      })

      // Then
      expect(result.estVisible).to.be.true()
      expect(result.autoinscription).to.be.false()
    })

    it('met à jour dateModification', () => {
      // Given
      const session = uneSessionMilo()

      // When
      const result = SessionMilo.modifier(session, maintenant)

      // Then
      expect(result.dateModification).to.deep.equal(maintenant)
    })

    describe('autodesinscription', () => {
      it('peut être activée si autoinscription est active', () => {
        // Given
        const session = uneSessionMilo({
          estVisible: true,
          autoinscription: true,
          autodesinscription: false
        })

        // When
        const result = SessionMilo.modifier(session, maintenant, {
          nouvelleAutoinscription: true,
          nouvelleAutodesinscription: true
        })

        // Then
        expect(result.autodesinscription).to.be.true()
      })

      it("conserve sa valeur quand autoinscription est active et aucune nouvelle valeur n'est fournie", () => {
        // Given
        const session = uneSessionMilo({
          estVisible: true,
          autoinscription: true,
          autodesinscription: true
        })

        // When
        const result = SessionMilo.modifier(session, maintenant, {
          nouvelleAutoinscription: true
        })

        // Then
        expect(result.autodesinscription).to.be.true()
      })

      it('est automatiquement désactivée si autoinscription est à false', () => {
        // Given
        const session = uneSessionMilo({
          estVisible: true,
          autoinscription: true,
          autodesinscription: true
        })

        // When
        const result = SessionMilo.modifier(session, maintenant, {
          nouvelleAutoinscription: false,
          nouvelleAutodesinscription: true
        })

        // Then
        expect(result.autodesinscription).to.be.false()
      })
    })
  })

  describe('calculerDateMaxDesinscription', () => {
    const dateHeureDebut = DateTime.fromISO('2020-04-06T10:00:00.000Z')

    it('retourne dateMaxInscription si elle existe', () => {
      // Given
      const dateMaxInscription = DateTime.fromISO('2020-04-05T21:59:59.999Z')

      // When
      const result = SessionMilo.calculerDateMaxDesinscription(
        dateHeureDebut,
        dateMaxInscription
      )

      // Then
      expect(result).to.deep.equal(dateMaxInscription)
    })

    it('retourne dateHeureDebut - 24h si dateMaxInscription est absente', () => {
      // When
      const result = SessionMilo.calculerDateMaxDesinscription(dateHeureDebut)

      // Then
      expect(result).to.deep.equal(DateTime.fromISO('2020-04-05T10:00:00.000Z'))
    })
  })

  describe('autodesinscriptionEffectivePourBeneficiaire', () => {
    const dateMaxDesinscription = DateTime.fromISO('2020-04-05T21:59:59.999Z')

    it('retourne false si autodesinscription est false en config', () => {
      // When
      const result = SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
        false,
        dateMaxDesinscription,
        DateTime.fromISO('2020-04-04T00:00:00.000Z')
      )

      // Then
      expect(result).to.be.false()
    })

    it('retourne true si autodesinscription est true et maintenant <= dateMaxDesinscription', () => {
      // When
      const result = SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
        true,
        dateMaxDesinscription,
        DateTime.fromISO('2020-04-04T00:00:00.000Z')
      )

      // Then
      expect(result).to.be.true()
    })

    it('retourne false si autodesinscription est true mais dateMaxDesinscription dépassée', () => {
      // When
      const result = SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
        true,
        dateMaxDesinscription,
        DateTime.fromISO('2020-04-06T00:00:00.000Z')
      )

      // Then
      expect(result).to.be.false()
    })
  })

  describe('peutInscrireBeneficiaire', () => {
    const maintenant = DateTime.fromISO('2020-04-05T10:00:00.000Z')
    const dateMaxInscription = DateTime.fromISO('2020-04-06T13:20:00.000Z')

    it('réussi s’il n’y a pas de maximum de places', async () => {
      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({ dateMaxInscription }),
        maintenant
      )

      // Then
      expect(isSuccess(result)).to.be.true()
    })

    it('réussi s’il reste des places', async () => {
      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({ nbPlacesDisponibles: 12, dateMaxInscription }),
        maintenant
      )

      // Then
      expect(isSuccess(result)).to.be.true()
    })

    it('échoue si l’autoinscription est désactivée', async () => {
      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({ autoinscription: false, dateMaxInscription }),
        maintenant
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it('échoue si la dateMaxInscription est dépassée', async () => {
      // Given
      const maintenantApres = DateTime.fromISO('2020-04-07T10:00:00.000Z')

      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({ dateMaxInscription }),
        maintenantApres
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it('échoue s’il n’y a plus de place disponible', async () => {
      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({ nbPlacesDisponibles: 0, dateMaxInscription }),
        maintenant
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(
        NombrePlacesInsuffisantError
      )
    })

    it('échoue si le bénéficiaire est déjà inscrit', async () => {
      // When
      const result = SessionMilo.peutInscrireBeneficiaire(
        uneSessionMiloAllegee({
          statutInscription: SessionMilo.Inscription.Statut.INSCRIT,
          dateMaxInscription
        }),
        maintenant
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(
        BeneficiaireDejaInscritError
      )
    })
  })

  describe('peutDesinscrireBeneficiaire', () => {
    const maintenant = DateTime.fromISO('2020-04-04T10:00:00.000Z')
    const dateMaxDesinscription = DateTime.fromISO('2020-04-05T10:00:00.000Z')

    it('réussit si inscrit, autodesinscription active et dans les délais', () => {
      // When
      const result = SessionMilo.peutDesinscrireBeneficiaire(
        uneSessionMiloAllegee({
          statutInscription: SessionMilo.Inscription.Statut.INSCRIT,
          autodesinscription: true,
          dateMaxDesinscription
        }),
        maintenant
      )

      // Then
      expect(isSuccess(result)).to.be.true()
    })

    it("échoue si le bénéficiaire n'est pas inscrit", () => {
      // When
      const result = SessionMilo.peutDesinscrireBeneficiaire(
        uneSessionMiloAllegee({
          statutInscription: undefined,
          autodesinscription: true,
          dateMaxDesinscription
        }),
        maintenant
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it("échoue si l'autodesinscription est désactivée", () => {
      // When
      const result = SessionMilo.peutDesinscrireBeneficiaire(
        uneSessionMiloAllegee({
          statutInscription: SessionMilo.Inscription.Statut.INSCRIT,
          autodesinscription: false,
          dateMaxDesinscription
        }),
        maintenant
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it('échoue si la dateMaxDesinscription est dépassée', () => {
      // Given
      const maintenantApres = DateTime.fromISO('2020-04-06T10:00:00.000Z')

      // When
      const result = SessionMilo.peutDesinscrireBeneficiaire(
        uneSessionMiloAllegee({
          statutInscription: SessionMilo.Inscription.Statut.INSCRIT,
          autodesinscription: true,
          dateMaxDesinscription
        }),
        maintenantApres
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })
  })
})

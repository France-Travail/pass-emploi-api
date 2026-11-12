import { expect } from '../../utils'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Profil } from '../../../src/domain/profil'
import { unJeune, unJeuneNonAccompagne } from '../../fixtures/jeune.fixture'
import { unConseiller } from '../../fixtures/conseiller.fixture'

describe('Jeune', () => {
  describe('estAccompagne', () => {
    it('renvoie true pour un jeune dans un dispositif accompagné', () => {
      // Given
      const jeune = unJeune({ dispositif: Profil.Dispositif.CEJ })

      // When - Then
      expect(Jeune.estAccompagne(jeune)).to.equal(true)
    })

    it('renvoie true pour un jeune suivi par le conseil départemental', () => {
      // Given
      const jeune = unJeune({
        structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
        dispositif: null
      })

      // When - Then
      expect(Jeune.estAccompagne(jeune)).to.equal(true)
    })

    for (const dispositif of [
      Profil.Dispositif.DEMANDEUR_D_EMPLOI,
      Profil.Dispositif.ESPACE_CANDIDAT
    ]) {
      it(`renvoie false pour un jeune non accompagné (${dispositif}) sans conseiller`, () => {
        // Given
        const jeune = unJeuneNonAccompagne({ dispositif })

        // When - Then
        expect(Jeune.estAccompagne(jeune)).to.equal(false)
      })
    }

    it('renvoie true pour un jeune non accompagné déjà rattaché à un conseiller', () => {
      // Given
      const jeune = unJeune({
        dispositif: Profil.Dispositif.DEMANDEUR_D_EMPLOI
      })

      // When - Then
      expect(Jeune.estAccompagne(jeune)).to.equal(true)
    })
  })

  describe('reprendreEnAccompagnement', () => {
    it('rattache le jeune au conseiller avec sa structure et son dispositif, et active ses préférences', () => {
      // Given
      const jeune = unJeuneNonAccompagne({
        preferences: {
          partageFavoris: true,
          alertesOffres: true,
          messages: false,
          creationActionConseiller: false,
          rendezVousSessions: true,
          rappelActions: true,
          actualitesMilo: true
        }
      })
      const conseiller = unConseiller({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
      })

      // When
      const jeuneAccompagne = Jeune.reprendreEnAccompagnement(jeune, conseiller)

      // Then
      expect(jeuneAccompagne).to.deep.equal({
        ...jeune,
        conseiller: {
          id: conseiller.id,
          lastName: conseiller.lastName,
          firstName: conseiller.firstName,
          email: conseiller.email
        },
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
        preferences: {
          ...jeune.preferences,
          messages: true,
          creationActionConseiller: true
        }
      })
    })

    it('ne donne pas de dispositif au jeune repris par un conseiller départemental', () => {
      // Given
      const jeune = unJeuneNonAccompagne()
      const conseiller = unConseiller({
        structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
        dispositif: null
      })

      // When
      const jeuneAccompagne = Jeune.reprendreEnAccompagnement(jeune, conseiller)

      // Then
      expect(jeuneAccompagne.structure).to.equal(
        Profil.Structure.CONSEIL_DEPARTEMENTAL
      )
      expect(jeuneAccompagne.dispositif).to.equal(null)
    })

    it('lève une erreur si le conseiller ne peut pas accompagner', () => {
      // Given
      const conseiller = unConseiller({
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ
      })

      // When - Then
      expect(() =>
        Jeune.reprendreEnAccompagnement(unJeuneNonAccompagne(), conseiller)
      ).to.throw()
    })
  })
})

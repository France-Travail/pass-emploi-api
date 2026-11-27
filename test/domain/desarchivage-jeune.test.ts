import { DesarchivageJeune } from '../../src/domain/desarchivage-jeune'
import { Profil } from '../../src/domain/profil'
import { expect } from '../utils'
import RaisonIgnoree = DesarchivageJeune.RaisonIgnoree

describe('DesarchivageJeune', () => {
  describe('choisirLaCible', () => {
    const idConseiller = 'conseiller-cible'
    const conseiller: DesarchivageJeune.ConseillerCible = {
      id: idConseiller,
      structure: Profil.Structure.FRANCE_TRAVAIL
    }
    const archive: DesarchivageJeune.Archive = {
      email: 'jeune@email.fr',
      structure: Profil.Structure.FRANCE_TRAVAIL
    }
    const unCompte = (
      compte: Partial<DesarchivageJeune.CompteExistant> = {}
    ): DesarchivageJeune.CompteExistant => ({
      id: 'compte-recree',
      idConseiller,
      structure: Profil.Structure.FRANCE_TRAVAIL,
      ...compte
    })

    it("recrée le jeune quand aucun compte ne correspond à l'archive", () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(archive, [], conseiller)

      // Then
      expect(cible).to.deep.equal({ type: 'RECREATION' })
    })

    it('fusionne avec le compte suivi par le conseiller, sans le rattacher', () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        archive,
        [unCompte()],
        conseiller
      )

      // Then
      expect(cible).to.deep.equal({
        type: 'FUSION',
        idJeune: 'compte-recree',
        rattacherAuConseiller: false
      })
    })

    it('fusionne avec un compte sans conseiller en le rattachant au conseiller', () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        archive,
        [unCompte({ idConseiller: null })],
        conseiller
      )

      // Then
      expect(cible).to.deep.equal({
        type: 'FUSION',
        idJeune: 'compte-recree',
        rattacherAuConseiller: true
      })
    })

    it("ignore l'archive sans email", () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        { ...archive, email: null },
        [],
        conseiller
      )

      // Then
      expect(cible).to.include({
        type: 'IGNOREE',
        raison: RaisonIgnoree.ARCHIVE_SANS_EMAIL
      })
    })

    it('ignore quand plusieurs comptes correspondent', () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        archive,
        [unCompte({ id: 'compte-1' }), unCompte({ id: 'compte-2' })],
        conseiller
      )

      // Then
      expect(cible).to.include({
        type: 'IGNOREE',
        raison: RaisonIgnoree.PLUSIEURS_COMPTES
      })
    })

    it("ignore un compte d'une autre structure", () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        archive,
        [unCompte({ structure: Profil.Structure.MILO })],
        conseiller
      )

      // Then
      expect(cible).to.include({
        type: 'IGNOREE',
        raison: RaisonIgnoree.AUTRE_STRUCTURE
      })
    })

    it('ignore un compte suivi par un autre conseiller', () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(
        archive,
        [unCompte({ idConseiller: 'autre-conseiller' })],
        conseiller
      )

      // Then
      expect(cible).to.include({
        type: 'IGNOREE',
        raison: RaisonIgnoree.AUTRE_CONSEILLER
      })
    })

    it("ignore quand le conseiller n'est pas de la structure de l'archive", () => {
      // When
      const cible = DesarchivageJeune.choisirLaCible(archive, [], {
        id: idConseiller,
        structure: Profil.Structure.MILO
      })

      // Then
      expect(cible).to.include({
        type: 'IGNOREE',
        raison: RaisonIgnoree.CONSEILLER_AUTRE_STRUCTURE
      })
    })
  })
})

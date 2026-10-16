import { expect } from '../../utils'
import { JeuneMilo } from '../../../src/domain/milo/jeune.milo'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { unJeune } from '../../fixtures/jeune.fixture'
import { unConseiller } from '../../fixtures/conseiller.fixture'
import { Profil } from '../../../src/domain/profil'
import { MauvaiseCommandeError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { uneDatetime } from '../../fixtures/date.fixture'

describe('Milo', () => {
  const situationsPrevuEmploi = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.EMPLOI
  }
  const situationsPrevuAlternance = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.CONTRAT_EN_ALTERNANCE
  }
  const situationsPrevuFormation = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.FORMATION
  }
  const situationsPrevuImmersion = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.IMMERSION_EN_ENTREPRISE
  }
  const situationsPrevuPmsmp = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.PMSMP
  }
  const situationsPrevuVolontariat = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.CONTRAT_DE_VOLONTARIAT_BENEVOLAT
  }
  const situationsPrevuScolarite = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.SCOLARITE
  }
  const situationsPrevuDemandeur = {
    etat: JeuneMilo.EtatSituation.PREVU,
    categorie: JeuneMilo.CategorieSituation.DEMANDEUR_D_EMPLOI
  }
  const situationsEnCoursEmploi = {
    etat: JeuneMilo.EtatSituation.EN_COURS,
    categorie: JeuneMilo.CategorieSituation.EMPLOI
  }
  const situationsEnCoursScolarite = {
    etat: JeuneMilo.EtatSituation.EN_COURS,
    categorie: JeuneMilo.CategorieSituation.SCOLARITE
  }
  const situationsEnCoursDemandeur = {
    etat: JeuneMilo.EtatSituation.EN_COURS,
    categorie: JeuneMilo.CategorieSituation.DEMANDEUR_D_EMPLOI
  }
  const situationsTermineeEmploi = {
    etat: JeuneMilo.EtatSituation.TERMINE,
    categorie: JeuneMilo.CategorieSituation.EMPLOI
  }

  // Given
  const situations = [
    situationsPrevuScolarite,
    situationsPrevuEmploi,
    situationsTermineeEmploi,
    situationsPrevuPmsmp,
    situationsPrevuFormation,
    situationsPrevuDemandeur,
    situationsEnCoursEmploi,
    situationsPrevuAlternance,
    situationsPrevuImmersion,
    situationsPrevuVolontariat,
    situationsEnCoursDemandeur,
    situationsEnCoursScolarite
  ]

  // When
  const situationsTriees = JeuneMilo.trierSituations(situations)

  describe('trierSituations', () => {
    it('trie les situations par etat et categorie', async () => {
      // Then
      expect(situationsTriees).to.deep.equal([
        situationsEnCoursEmploi,
        situationsEnCoursScolarite,
        situationsEnCoursDemandeur,
        situationsPrevuEmploi,
        situationsPrevuAlternance,
        situationsPrevuFormation,
        situationsPrevuImmersion,
        situationsPrevuPmsmp,
        situationsPrevuVolontariat,
        situationsPrevuScolarite,
        situationsPrevuDemandeur,
        situationsTermineeEmploi
      ])
    })
  })
  describe('trouverSituationCourante', () => {
    it('retourne la situation en cours quand elle existe', async () => {
      // When
      const situationCourante =
        JeuneMilo.trouverSituationCourante(situationsTriees)

      // Then
      expect(situationCourante).to.deep.equal(situationsEnCoursEmploi)
    })
    it('ne retourne rien quand aucune situation en cours', async () => {
      // When
      const situationCourante = JeuneMilo.trouverSituationCourante([
        situationsPrevuScolarite,
        situationsPrevuEmploi,
        situationsTermineeEmploi,
        situationsPrevuPmsmp
      ])

      // Then
      expect(situationCourante).to.deep.equal(undefined)
    })
  })

  describe('mettre à jour le dispositif', () => {
    it("ne peut voir le comptage des heures si PACEA alors qu'il pouvait en CEJ", () => {
      const jeune = unJeune({
        peutVoirLeComptageDesHeures: true
      })

      const jeuneAJour = Jeune.mettreAJourDispositif(
        jeune,
        Profil.Dispositif.PACEA
      )

      expect(jeuneAJour.dispositif).equal(Profil.Dispositif.PACEA)
      expect(jeuneAJour.peutVoirLeComptageDesHeures).equal(false)
    })

    it("ne peut voir le comptage des heures en Autre alors qu'il pouvait en CEJ", () => {
      const jeune = unJeune({
        peutVoirLeComptageDesHeures: true
      })

      const jeuneAJour = Jeune.mettreAJourDispositif(
        jeune,
        Profil.Dispositif.AUTRE
      )

      expect(jeuneAJour.dispositif).equal(Profil.Dispositif.AUTRE)
      expect(jeuneAJour.peutVoirLeComptageDesHeures).equal(false)
    })

    it('Lors du changement de dispositif de CEJ à PACEA si peutVoirLeComptageDesHeures était à faux il reste a faux', () => {
      const jeune = unJeune({
        peutVoirLeComptageDesHeures: false
      })

      const jeuneAJour = Jeune.mettreAJourDispositif(
        jeune,
        Profil.Dispositif.PACEA
      )

      expect(jeuneAJour.dispositif).equal(Profil.Dispositif.PACEA)
      expect(jeuneAJour.peutVoirLeComptageDesHeures).equal(false)
    })

    it('le jeune est suivi temporairement ', () => {
      const jeune = unJeune({
        conseillerInitial: unConseiller()
      })

      const estSuiviTemporairement = Jeune.estSuiviTemporairement(jeune)

      expect(estSuiviTemporairement).equal(true)
    })
  })

  describe('changerDeDispositif', () => {
    const dateFinAccompagnement = uneDatetime().plus({ days: 3 })

    it("bascule le dispositif, retire le compteur des heures et fait repartir l'accompagnement à la date de fin", () => {
      // Given
      const jeune = unJeune({
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ,
        peutVoirLeComptageDesHeures: true
      })

      // When
      const result = JeuneMilo.changerDeDispositif(
        jeune,
        Profil.Dispositif.AUTRE,
        dateFinAccompagnement
      )

      // Then
      expect(result).to.deep.equal(
        success({
          ...jeune,
          dispositif: Profil.Dispositif.AUTRE,
          peutVoirLeComptageDesHeures: false,
          creationDate: dateFinAccompagnement
        })
      )
    })

    it("refuse un bénéficiaire qui n'est pas suivi par une Mission Locale", () => {
      // Given
      const jeune = unJeune({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.AIJ
      })

      // When
      const result = JeuneMilo.changerDeDispositif(
        jeune,
        Profil.Dispositif.CEJ,
        dateFinAccompagnement
      )

      // Then
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            "Ce bénéficiaire n'est pas suivi par une Mission Locale"
          )
        )
      )
    })

    it("refuse un dispositif qui n'est pas proposé par les Missions Locales", () => {
      // Given
      const jeune = unJeune({
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ
      })

      // When
      const result = JeuneMilo.changerDeDispositif(
        jeune,
        Profil.Dispositif.BRSA,
        dateFinAccompagnement
      )

      // Then
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            "Ce dispositif n'est pas proposé par les Missions Locales"
          )
        )
      )
    })
  })
})

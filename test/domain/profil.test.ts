import {
  aAccesAuxAlternancesEtServicesCiviques,
  DISPOSITIFS_ACCOMPAGNES,
  DISPOSITIFS_FT_HORS_AVENIR_PRO,
  estBeneficiaireFTConnect,
  estPassEmploi,
  memeProfil,
  Profil,
  profilEstAutorise,
  profilExact,
  profilVersStructureLegacy,
  structureLegacyVersProfil,
  TOUT_PROFIL,
  verifierProfils
} from '../../src/domain/profil'
import {
  unProfilCD,
  unProfilFT,
  unProfilInvite,
  unProfilMilo
} from '../fixtures/profil.fixture'
import { expect } from '../utils'

import { isFailure, isSuccess } from '../../src/building-blocks/types/result'
import { Authentification } from '../../src/domain/authentification'
import { Core } from '../../src/domain/core'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../fixtures/authentification.fixture'

type UnProfil = ReturnType<typeof structureLegacyVersProfil>

describe('Profil', () => {
  describe('codec structure legacy ↔ profil', () => {
    const attendus: Record<Core.Structure, UnProfil> = {
      [Core.Structure.MILO]: {
        structure: Profil.Structure.MILO,
        dispositif: null
      },
      [Core.Structure.POLE_EMPLOI]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      },
      [Core.Structure.POLE_EMPLOI_BRSA]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.BRSA
      },
      [Core.Structure.POLE_EMPLOI_AIJ]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.AIJ
      },
      [Core.Structure.AVENIR_PRO]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.AVENIR_PRO
      },
      [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF
      },
      [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
      },
      [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.EQUIP_EMPLOI_RECRUT
      },
      [Core.Structure.FT_DEMANDEUR_D_EMPLOI]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.DEMANDEUR_D_EMPLOI
      },
      [Core.Structure.FT_ESPACE_CANDIDAT]: {
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ESPACE_CANDIDAT
      },
      [Core.Structure.CONSEIL_DEPT]: {
        structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
        dispositif: null
      },
      [Core.Structure.INVITE]: {
        structure: Profil.Structure.INVITE,
        dispositif: null
      }
    }

    for (const structure of Object.values(Core.Structure)) {
      it(`associe la structure legacy ${structure} au bon profil`, () => {
        expect(structureLegacyVersProfil(structure)).to.deep.equal(
          attendus[structure]
        )
      })
    }

    it('replie chaque structure legacy sur elle-même (aller-retour)', () => {
      for (const structure of Object.values(Core.Structure)) {
        expect(
          profilVersStructureLegacy(structureLegacyVersProfil(structure))
        ).to.equal(structure)
      }
    })

    it('replie chaque profil MiLo sur MILO quel que soit le dispositif', () => {
      expect(
        profilVersStructureLegacy({
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.PACEA
        })
      ).to.equal(Core.Structure.MILO)
    })
  })

  describe('profilEstAutorise', () => {
    it('un dispositif null est autorisé dès que la structure l’est', () => {
      const jeuneMiloVuDuToken: UnProfil = {
        structure: Profil.Structure.MILO,
        dispositif: null
      }
      expect(
        profilEstAutorise(jeuneMiloVuDuToken, DISPOSITIFS_ACCOMPAGNES)
      ).to.equal(true)
    })

    it('dispositifs absent = toute la structure', () => {
      expect(
        profilEstAutorise(
          {
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif: Profil.Dispositif.ESPACE_CANDIDAT
          },
          TOUT_PROFIL
        )
      ).to.equal(true)
    })

    it('refuse une structure non listée ou un dispositif hors liste', () => {
      expect(
        profilEstAutorise(
          { structure: Profil.Structure.INVITE, dispositif: null },
          DISPOSITIFS_ACCOMPAGNES
        )
      ).to.equal(false)
      expect(
        profilEstAutorise(
          {
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif: Profil.Dispositif.ESPACE_CANDIDAT
          },
          DISPOSITIFS_ACCOMPAGNES
        )
      ).to.equal(false)
    })
  })

  describe('verifierProfils', () => {
    it("autorise l'exécution sans utilisateur (tâches)", () => {
      expect(isSuccess(verifierProfils([], undefined))).to.equal(true)
    })

    it('le support est hors du modèle de profil : il passe toujours', () => {
      expect(
        isSuccess(verifierProfils([], Authentification.unUtilisateurSupport()))
      ).to.equal(true)
    })

    it('une liste vide ferme à tous les profils', () => {
      expect(isFailure(verifierProfils([], unUtilisateurJeune()))).to.equal(
        true
      )
      expect(
        isFailure(verifierProfils([], unUtilisateurConseiller()))
      ).to.equal(true)
    })

    it('contrôle le profil du claim, jeune comme conseiller', () => {
      expect(
        isSuccess(
          verifierProfils(DISPOSITIFS_ACCOMPAGNES, unUtilisateurJeune())
        )
      ).to.equal(true)
      expect(
        isSuccess(
          verifierProfils(DISPOSITIFS_ACCOMPAGNES, unUtilisateurConseiller())
        )
      ).to.equal(true)
      expect(
        isFailure(
          verifierProfils(
            DISPOSITIFS_ACCOMPAGNES,
            unUtilisateurJeune({
              profil: unProfilFT(Profil.Dispositif.ESPACE_CANDIDAT)
            })
          )
        )
      ).to.equal(true)
    })
  })
})

describe('Règles de profil', () => {
  describe('estBeneficiaireFTConnect', () => {
    it('inclut France Travail (tout dispositif) et le Conseil départemental', () => {
      expect(estBeneficiaireFTConnect(unProfilFT())).to.equal(true)
      expect(
        estBeneficiaireFTConnect(unProfilFT(Profil.Dispositif.ESPACE_CANDIDAT))
      ).to.equal(true)
      expect(estBeneficiaireFTConnect(unProfilCD())).to.equal(true)
      expect(estBeneficiaireFTConnect(unProfilMilo())).to.equal(false)
      expect(estBeneficiaireFTConnect(unProfilInvite())).to.equal(false)
    })
  })

  describe('aAccesAuxAlternancesEtServicesCiviques', () => {
    it('autorise MiLo, FT CEJ et FT AIJ seulement', () => {
      expect(aAccesAuxAlternancesEtServicesCiviques(unProfilMilo())).to.equal(
        true
      )
      expect(aAccesAuxAlternancesEtServicesCiviques(unProfilFT())).to.equal(
        true
      )
      expect(
        aAccesAuxAlternancesEtServicesCiviques(
          unProfilFT(Profil.Dispositif.AIJ)
        )
      ).to.equal(true)
      expect(
        aAccesAuxAlternancesEtServicesCiviques(
          unProfilFT(Profil.Dispositif.BRSA)
        )
      ).to.equal(false)
      expect(aAccesAuxAlternancesEtServicesCiviques(unProfilCD())).to.equal(
        false
      )
    })
  })

  describe('estPassEmploi', () => {
    it('vaut pour FT hors CEJ et pour le Conseil départemental', () => {
      expect(estPassEmploi(unProfilFT())).to.equal(false)
      expect(estPassEmploi(unProfilFT(Profil.Dispositif.BRSA))).to.equal(true)
      expect(estPassEmploi(unProfilCD())).to.equal(true)
      expect(estPassEmploi(unProfilMilo())).to.equal(false)
    })
  })

  describe('DISPOSITIFS_FT_HORS_AVENIR_PRO', () => {
    it('exclut AVENIR_PRO et PACEA', () => {
      expect(DISPOSITIFS_FT_HORS_AVENIR_PRO.dispositifs).not.to.include(
        Profil.Dispositif.AVENIR_PRO
      )
      expect(DISPOSITIFS_FT_HORS_AVENIR_PRO.dispositifs).not.to.include(
        Profil.Dispositif.PACEA
      )
      expect(DISPOSITIFS_FT_HORS_AVENIR_PRO.dispositifs).to.include(
        Profil.Dispositif.DEMANDEUR_D_EMPLOI
      )
    })
  })

  describe('memeProfil', () => {
    it('un dispositif null ne contraint que la structure', () => {
      expect(
        memeProfil(unProfilMilo(), unProfilMilo(Profil.Dispositif.PACEA))
      ).to.equal(true)
      expect(memeProfil(unProfilFT(), unProfilFT())).to.equal(true)
      expect(
        memeProfil(unProfilFT(), unProfilFT(Profil.Dispositif.BRSA))
      ).to.equal(false)
      expect(memeProfil(unProfilFT(), unProfilCD())).to.equal(false)
    })
  })

  describe('profilExact', () => {
    it('ne liste le dispositif que s’il est renseigné', () => {
      expect(profilExact(unProfilMilo())).to.deep.equal({
        structure: Profil.Structure.MILO
      })
      expect(profilExact(unProfilFT(Profil.Dispositif.BRSA))).to.deep.equal({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositifs: [Profil.Dispositif.BRSA]
      })
    })
  })
})

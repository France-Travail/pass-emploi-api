import { Core } from '../../src/domain/core'
import {
  Profil,
  profilConseillerDe,
  profilJeuneDe
} from '../../src/domain/profil'
import { expect } from '../utils'

describe('profilJeuneDe', () => {
  const attendus: Record<Core.Structure, Profil.Jeune> = {
    [Core.Structure.MILO]: Profil.Jeune.MILO,
    [Core.Structure.POLE_EMPLOI]: Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    [Core.Structure.POLE_EMPLOI_AIJ]:
      Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    [Core.Structure.AVENIR_PRO]: Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    [Core.Structure.POLE_EMPLOI_BRSA]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]:
      Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.CONSEIL_DEPT]: Profil.Jeune.CONSEIL_DEPT,
    [Core.Structure.INVITE]: Profil.Jeune.INVITE,
    [Core.Structure.FT_ESPACE_CANDIDAT]: Profil.Jeune.FT_ESPACE_CANDIDAT
  }

  for (const structure of Object.values(Core.Structure)) {
    it(`associe la structure ${structure} au bon profil jeune`, () => {
      // Given
      const profilAttendu = attendus[structure]

      // When
      const profil = profilJeuneDe(structure)

      // Then
      expect(profil).to.equal(profilAttendu)
    })
  }
})

describe('profilConseillerDe', () => {
  const attendus: Record<Core.Structure, Profil.Conseiller | undefined> = {
    [Core.Structure.MILO]: Profil.Conseiller.MILO,
    [Core.Structure.POLE_EMPLOI]: Profil.Conseiller.FT,
    [Core.Structure.POLE_EMPLOI_AIJ]: Profil.Conseiller.FT,
    [Core.Structure.AVENIR_PRO]: Profil.Conseiller.FT,
    [Core.Structure.POLE_EMPLOI_BRSA]: Profil.Conseiller.FT,
    [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]: Profil.Conseiller.FT,
    [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: Profil.Conseiller.FT,
    [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: Profil.Conseiller.FT,
    [Core.Structure.CONSEIL_DEPT]: Profil.Conseiller.CONSEIL_DEPT,
    [Core.Structure.INVITE]: undefined,
    [Core.Structure.FT_ESPACE_CANDIDAT]: undefined
  }

  for (const structure of Object.values(Core.Structure)) {
    it(`associe la structure ${structure} au bon profil conseiller`, () => {
      // Given
      const profilAttendu = attendus[structure]

      // When
      const profil = profilConseillerDe(structure)

      // Then
      expect(profil).to.equal(profilAttendu)
    })
  }
})

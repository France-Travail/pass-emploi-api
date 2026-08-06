import { Core } from '../../src/domain/core'
import { Profil, profilDe } from '../../src/domain/profil'
import { expect } from '../utils'

describe('profilDe', () => {
  const attendus: Record<Core.Structure, Profil> = {
    [Core.Structure.MILO]: Profil.MILO,
    [Core.Structure.POLE_EMPLOI]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.POLE_EMPLOI_BRSA]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.POLE_EMPLOI_AIJ]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.CONSEIL_DEPT]: Profil.CONSEIL_DEPT,
    [Core.Structure.AVENIR_PRO]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: Profil.FT_DEMANDEUR_EMPLOI,
    [Core.Structure.FT_ESPACE_CANDIDAT]: Profil.FT_ESPACE_CANDIDAT,
    [Core.Structure.INVITE]: Profil.INVITE
  }

  for (const structure of Object.values(Core.Structure)) {
    it(`associe la structure ${structure} au bon profil`, () => {
      // Given
      const profilAttendu = attendus[structure]

      // When
      const profil = profilDe(structure)

      // Then
      expect(profil).to.equal(profilAttendu)
    })
  }
})

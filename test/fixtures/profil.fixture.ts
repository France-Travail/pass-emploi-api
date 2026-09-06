import { Profil } from '../../src/domain/profil'

export const unProfilMilo = (
  dispositif: Profil.Dispositif | null = null
): Profil => ({ structure: Profil.Structure.MILO, dispositif })

export const unProfilFT = (
  dispositif: Profil.Dispositif = Profil.Dispositif.CEJ
): Profil => ({ structure: Profil.Structure.FRANCE_TRAVAIL, dispositif })

export const unProfilCD = (): Profil => ({
  structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
  dispositif: null
})

export const unProfilInvite = (): Profil => ({
  structure: Profil.Structure.INVITE,
  dispositif: null
})

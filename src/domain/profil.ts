import { Core } from './core'

export enum Profil {
  MILO = 'MILO',
  FT_DEMANDEUR_EMPLOI_ACCOMPAGNE = 'FT_DEMANDEUR_EMPLOI_ACCOMPAGNE',
  FT_DEMANDEUR_EMPLOI = 'FT_DEMANDEUR_EMPLOI',
  FT_ESPACE_CANDIDAT = 'FT_ESPACE_CANDIDAT',
  CONSEIL_DEPT = 'CONSEIL_DEPT',
  INVITE = 'INVITE',
  // Les bénéficiaires se déclinent en publics ; conseillers et support n'ont
  // aujourd'hui aucune subdivision qu'une règle d'accès distingue.
  CONSEILLER = 'CONSEILLER',
  SUPPORT = 'SUPPORT'
}

export const TOUS_LES_PROFILS = Object.values(Profil)

// TODO: table de transition. `Core.Structure` mélange organisation et
// dispositif, mais elle est figée par le JWT émis par `connect`, les payloads
// web/app et l'analytics : impossible de l'éclater depuis l'API seule. Le
// profil est la vue « publics » qu'on en dérive en attendant ce chantier
// multi-repos.
const PROFILS: Record<Core.Structure, Profil> = {
  [Core.Structure.MILO]: Profil.MILO,
  [Core.Structure.POLE_EMPLOI]: Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.POLE_EMPLOI_AIJ]: Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.AVENIR_PRO]: Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.POLE_EMPLOI_BRSA]: Profil.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]: Profil.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: Profil.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: Profil.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.CONSEIL_DEPT]: Profil.CONSEIL_DEPT,
  [Core.Structure.INVITE]: Profil.INVITE,
  [Core.Structure.FT_ESPACE_CANDIDAT]: Profil.FT_ESPACE_CANDIDAT
}

export function profilDe(structure: Core.Structure): Profil {
  return PROFILS[structure]
}

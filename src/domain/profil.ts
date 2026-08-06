import { Core } from './core'

export namespace Profil {
  export enum Jeune {
    MILO = 'JEUNE_MILO',
    FT_DEMANDEUR_EMPLOI_ACCOMPAGNE = 'JEUNE_FT_DEMANDEUR_EMPLOI_ACCOMPAGNE',
    FT_DEMANDEUR_EMPLOI = 'JEUNE_FT_DEMANDEUR_EMPLOI',
    FT_ESPACE_CANDIDAT = 'JEUNE_FT_ESPACE_CANDIDAT',
    CONSEIL_DEPT = 'JEUNE_CONSEIL_DEPT',
    INVITE = 'JEUNE_INVITE'
  }
  export enum Conseiller {
    MILO = 'CONSEILLER_MILO',
    FT = 'CONSEILLER_FT',
    CONSEIL_DEPT = 'CONSEILLER_CONSEIL_DEPT'
  }
  export enum Support {
    SUPPORT = 'SUPPORT'
  }
}
// Fusion namespace + type valide en TypeScript (le namespace porte les
// enums Jeune/Conseiller/Support, le type est leur union) : eslint ne
// reconnaît pas ce pattern et le signale à tort comme une redéclaration.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Profil = Profil.Jeune | Profil.Conseiller | Profil.Support

export const TOUS_LES_PROFILS: readonly Profil[] = [
  ...Object.values(Profil.Jeune),
  ...Object.values(Profil.Conseiller),
  ...Object.values(Profil.Support)
]

export const TOUS_LES_CONSEILLERS: readonly Profil.Conseiller[] = Object.values(
  Profil.Conseiller
)

// Sous-ensemble de Profil.Jeune, pas la totalité : exclut délibérément
// INVITE (accès fermé par défaut, ouvert route par route) et
// FT_ESPACE_CANDIDAT (aucune structure ne le produit aujourd'hui).
export const PROFILS_JEUNES_HORS_INVITE: readonly Profil.Jeune[] = [
  Profil.Jeune.MILO,
  Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  Profil.Jeune.FT_DEMANDEUR_EMPLOI,
  Profil.Jeune.CONSEIL_DEPT
]

// TODO: table de transition. `Core.Structure` mélange organisation et
// dispositif, mais elle est figée par le JWT émis par `connect`, les payloads
// web/app et l'analytics : impossible de l'éclater depuis l'API seule. Le
// profil est la vue « publics » qu'on en dérive en attendant ce chantier
// multi-repos.
const PROFILS_JEUNES: Record<Core.Structure, Profil.Jeune> = {
  [Core.Structure.MILO]: Profil.Jeune.MILO,
  [Core.Structure.POLE_EMPLOI]: Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.POLE_EMPLOI_AIJ]: Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.AVENIR_PRO]: Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
  [Core.Structure.POLE_EMPLOI_BRSA]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.FT_EQUIP_EMPLOI_RECRUT]: Profil.Jeune.FT_DEMANDEUR_EMPLOI,
  [Core.Structure.CONSEIL_DEPT]: Profil.Jeune.CONSEIL_DEPT,
  [Core.Structure.INVITE]: Profil.Jeune.INVITE,
  [Core.Structure.FT_ESPACE_CANDIDAT]: Profil.Jeune.FT_ESPACE_CANDIDAT
}

export function profilJeuneDe(structure: Core.Structure): Profil.Jeune {
  return PROFILS_JEUNES[structure]
}

// Un conseiller n'a jamais INVITE ni FT_ESPACE_CANDIDAT comme structure — ce
// sont des structures réservées aux bénéficiaires. `undefined` fait échouer
// verifierProfils (fermé par défaut) plutôt que de deviner un profil.
const PROFILS_CONSEILLERS: Record<
  Core.Structure,
  Profil.Conseiller | undefined
> = {
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

export function profilConseillerDe(
  structure: Core.Structure
): Profil.Conseiller | undefined {
  return PROFILS_CONSEILLERS[structure]
}

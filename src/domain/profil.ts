import { DroitsInsuffisants } from '../building-blocks/types/domain-error'
import { emptySuccess, failure, Result } from '../building-blocks/types/result'
import { Authentification } from './authentification'
import { Core } from './core'

export namespace Profil {
  export enum Structure {
    MILO = 'MILO',
    FRANCE_TRAVAIL = 'FRANCE_TRAVAIL',
    CONSEIL_DEPARTEMENTAL = 'CONSEIL_DEPARTEMENTAL',
    INVITE = 'INVITE'
  }

  export enum Dispositif {
    CEJ = 'CEJ',
    PACEA = 'PACEA',
    BRSA = 'BRSA',
    AIJ = 'AIJ',
    AVENIR_PRO = 'AVENIR_PRO',
    ACCOMPAGNEMENT_INTENSIF = 'ACCOMPAGNEMENT_INTENSIF',
    ACCOMPAGNEMENT_GLOBAL = 'ACCOMPAGNEMENT_GLOBAL',
    EQUIP_EMPLOI_RECRUT = 'EQUIP_EMPLOI_RECRUT',
    DEMANDEUR_D_EMPLOI = 'DEMANDEUR_D_EMPLOI',
    ESPACE_CANDIDAT = 'ESPACE_CANDIDAT'
  }
}

export interface Profil {
  structure: Profil.Structure
  dispositif: Profil.Dispositif | null
}

export interface ProfilAutorise {
  structure: Profil.Structure
  dispositifs?: readonly Profil.Dispositif[]
}

export const TOUT_MILO: ProfilAutorise = { structure: Profil.Structure.MILO }
export const TOUT_FRANCE_TRAVAIL: ProfilAutorise = {
  structure: Profil.Structure.FRANCE_TRAVAIL
}
export const TOUT_CONSEIL_DEPARTEMENTAL: ProfilAutorise = {
  structure: Profil.Structure.CONSEIL_DEPARTEMENTAL
}
export const TOUT_INVITE: ProfilAutorise = {
  structure: Profil.Structure.INVITE
}

export const DISPOSITIFS_FT_ACCOMPAGNES: ProfilAutorise = {
  structure: Profil.Structure.FRANCE_TRAVAIL,
  dispositifs: [
    Profil.Dispositif.CEJ,
    Profil.Dispositif.BRSA,
    Profil.Dispositif.AIJ,
    Profil.Dispositif.AVENIR_PRO,
    Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
    Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
    Profil.Dispositif.EQUIP_EMPLOI_RECRUT
  ]
}

export const DISPOSITIFS_FT_AVEC_DEMARCHES: ProfilAutorise = {
  structure: Profil.Structure.FRANCE_TRAVAIL,
  dispositifs: [
    ...DISPOSITIFS_FT_ACCOMPAGNES.dispositifs!,
    Profil.Dispositif.DEMANDEUR_D_EMPLOI
  ]
}

export const DISPOSITIFS_ACCOMPAGNES: readonly ProfilAutorise[] = [
  TOUT_MILO,
  DISPOSITIFS_FT_ACCOMPAGNES,
  TOUT_CONSEIL_DEPARTEMENTAL
]

export const TOUT_PROFIL: readonly ProfilAutorise[] = [
  TOUT_MILO,
  TOUT_FRANCE_TRAVAIL,
  TOUT_CONSEIL_DEPARTEMENTAL,
  TOUT_INVITE
]

export function profilEstAutorise(
  profil: Profil,
  profilsAutorises: readonly ProfilAutorise[]
): boolean {
  return profilsAutorises.some(
    autorise =>
      autorise.structure === profil.structure &&
      (autorise.dispositifs === undefined ||
        profil.dispositif === null ||
        autorise.dispositifs.includes(profil.dispositif))
  )
}

export function estDispositifNonAccompagne(
  dispositif: Profil.Dispositif | null | undefined
): boolean {
  return (
    dispositif === Profil.Dispositif.DEMANDEUR_D_EMPLOI ||
    dispositif === Profil.Dispositif.ESPACE_CANDIDAT
  )
}

export function estMilo(structure: Profil.Structure): boolean {
  return structure === Profil.Structure.MILO
}

export function estFranceTravail(structure: Profil.Structure): boolean {
  return structure === Profil.Structure.FRANCE_TRAVAIL
}

export function estConseilDepartemental(structure: Profil.Structure): boolean {
  return structure === Profil.Structure.CONSEIL_DEPARTEMENTAL
}

export function estInvite(structure: Profil.Structure): boolean {
  return structure === Profil.Structure.INVITE
}

// Règles métier exprimées sur le profil (structure × dispositif).

// Bénéficiaires dont l'IdP est FT Connect (le Conseil départemental inclus).
export const PROFILS_FT_CONNECT: readonly ProfilAutorise[] = [
  TOUT_FRANCE_TRAVAIL,
  TOUT_CONSEIL_DEPARTEMENTAL
]

export const DISPOSITIFS_FT_HORS_AVENIR_PRO: ProfilAutorise = {
  structure: Profil.Structure.FRANCE_TRAVAIL,
  dispositifs: Object.values(Profil.Dispositif).filter(
    dispositif =>
      dispositif !== Profil.Dispositif.AVENIR_PRO &&
      dispositif !== Profil.Dispositif.PACEA
  )
}

export const PROFILS_ALTERNANCE_ET_SERVICE_CIVIQUE: readonly ProfilAutorise[] =
  [
    TOUT_MILO,
    {
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositifs: [Profil.Dispositif.CEJ, Profil.Dispositif.AIJ]
    }
  ]

export const PROFILS_CAMPAGNES: readonly ProfilAutorise[] = [
  TOUT_MILO,
  {
    structure: Profil.Structure.FRANCE_TRAVAIL,
    dispositifs: [
      Profil.Dispositif.CEJ,
      Profil.Dispositif.BRSA,
      Profil.Dispositif.AIJ,
      Profil.Dispositif.AVENIR_PRO
    ]
  },
  TOUT_CONSEIL_DEPARTEMENTAL
]

export function estBeneficiaireFTConnect(profil: Profil): boolean {
  return profilEstAutorise(profil, PROFILS_FT_CONNECT)
}

export function aAccesAuxAlternancesEtServicesCiviques(
  profil: Profil
): boolean {
  return profilEstAutorise(profil, PROFILS_ALTERNANCE_ET_SERVICE_CIVIQUE)
}

// Marque « Pass Emploi » (vs CEJ) : FT hors CEJ, et Conseil départemental.
export function estPassEmploi(profil: Profil): boolean {
  return (
    estConseilDepartemental(profil.structure) ||
    (estFranceTravail(profil.structure) &&
      profil.dispositif !== Profil.Dispositif.CEJ)
  )
}

// Un dispositif null (MiLo vu du claim, CD, invité) ne contraint que la structure.
export function memeProfil(attendu: Profil, profil: Profil): boolean {
  return (
    attendu.structure === profil.structure &&
    (attendu.dispositif === null ||
      profil.dispositif === null ||
      attendu.dispositif === profil.dispositif)
  )
}

export function profilExact(profil: Profil): ProfilAutorise {
  return profil.dispositif === null
    ? { structure: profil.structure }
    : { structure: profil.structure, dispositifs: [profil.dispositif] }
}

export function verifierProfils(
  profilsAutorises: ProfilAutorise | readonly ProfilAutorise[],
  utilisateur?: Authentification.Utilisateur
): Result {
  // aucun profil à contrôler pour les tasks sans utilisateur
  if (!utilisateur) {
    return emptySuccess()
  }

  // Le support est controlé niveau controller (API KEY spéciale)
  if (utilisateur.type === Authentification.Type.SUPPORT) {
    return emptySuccess()
  }

  const profil = utilisateur.profil
  const listeProfilsAutorises =
    'structure' in profilsAutorises ? [profilsAutorises] : profilsAutorises
  if (!profilEstAutorise(profil, listeProfilsAutorises)) {
    return failure(new DroitsInsuffisants())
  }
  return emptySuccess()
}

// ————————————————————————————————————————————————————————————————————————
// Codec vers la structure legacy. `Core.Structure` reste le format
// d'échange hors tables jeune/conseiller : claim JWT `userStructure` (l'app
// mobile crashe sur une valeur inconnue), analytics (les dashboards agrègent
// sur ses valeurs), clés Redis de connect. Tables typées en Record
// exhaustif : ajouter une valeur d'un côté sans la mapper casse la
// compilation.
// ————————————————————————————————————————————————————————————————————————

const MAP_STRUCTURE_LEGACY_VERS_PROFIL: Record<Core.Structure, Profil> = {
  [Core.Structure.MILO]: {
    structure: Profil.Structure.MILO,
    dispositif: null //le claim ne distingue pas CEJ de PACEA, le dispositif exact d'un MiLo vit en DB
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

export function structureLegacyVersProfil(
  structureLegacy: Core.Structure
): Profil {
  return MAP_STRUCTURE_LEGACY_VERS_PROFIL[structureLegacy]
}

const MAP_DISPOSITIF_VERS_STRUCTURE_LEGACY_FT: Record<
  Profil.Dispositif,
  Core.Structure
> = {
  [Profil.Dispositif.CEJ]: Core.Structure.POLE_EMPLOI,
  [Profil.Dispositif.PACEA]: Core.Structure.POLE_EMPLOI,
  [Profil.Dispositif.BRSA]: Core.Structure.POLE_EMPLOI_BRSA,
  [Profil.Dispositif.AIJ]: Core.Structure.POLE_EMPLOI_AIJ,
  [Profil.Dispositif.AVENIR_PRO]: Core.Structure.AVENIR_PRO,
  [Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF]:
    Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF,
  [Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL]:
    Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL,
  [Profil.Dispositif.EQUIP_EMPLOI_RECRUT]:
    Core.Structure.FT_EQUIP_EMPLOI_RECRUT,
  [Profil.Dispositif.DEMANDEUR_D_EMPLOI]: Core.Structure.FT_DEMANDEUR_D_EMPLOI,
  [Profil.Dispositif.ESPACE_CANDIDAT]: Core.Structure.FT_ESPACE_CANDIDAT
}

// Repli vers le format d'échange (claim `userStructure`, analytics, Redis connect) : la seule porte de sortie du profil vers le legacy.
export function profilVersStructureLegacy(profil: Profil): Core.Structure {
  switch (profil.structure) {
    case Profil.Structure.MILO:
      return Core.Structure.MILO
    case Profil.Structure.CONSEIL_DEPARTEMENTAL:
      return Core.Structure.CONSEIL_DEPT
    case Profil.Structure.INVITE:
      return Core.Structure.INVITE
    case Profil.Structure.FRANCE_TRAVAIL:
      return MAP_DISPOSITIF_VERS_STRUCTURE_LEGACY_FT[
        profil.dispositif ?? Profil.Dispositif.CEJ
      ]
  }
}

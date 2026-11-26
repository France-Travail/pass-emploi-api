import { Profil } from './profil'

export namespace DesarchivageJeune {
  export interface Archive {
    email: string | null
    structure: Profil.Structure
  }

  export interface CompteExistant {
    id: string
    idConseiller: string | null
    structure: Profil.Structure
  }

  export interface ConseillerCible {
    id: string
    structure: Profil.Structure
  }

  export enum RaisonIgnoree {
    CONSEILLER_AUTRE_STRUCTURE = 'CONSEILLER_AUTRE_STRUCTURE',
    ARCHIVE_SANS_EMAIL = 'ARCHIVE_SANS_EMAIL',
    PLUSIEURS_COMPTES = 'PLUSIEURS_COMPTES',
    AUTRE_STRUCTURE = 'AUTRE_STRUCTURE',
    AUTRE_CONSEILLER = 'AUTRE_CONSEILLER'
  }

  export type Cible =
    | { type: 'RECREATION' }
    | { type: 'FUSION'; idJeune: string; rattacherAuConseiller: boolean }
    | { type: 'IGNOREE'; raison: RaisonIgnoree; message: string }

  export function choisirLaCible(
    archive: Archive,
    comptesExistants: CompteExistant[],
    conseiller: ConseillerCible
  ): Cible {
    if (conseiller.structure !== archive.structure) {
      return ignoree(
        RaisonIgnoree.CONSEILLER_AUTRE_STRUCTURE,
        `Le conseiller ${conseiller.id} est de structure ${conseiller.structure}, incompatible avec l'archive (${archive.structure})`
      )
    }
    if (!archive.email) {
      return ignoree(
        RaisonIgnoree.ARCHIVE_SANS_EMAIL,
        "L'archive ne contient pas d'email : impossible de vérifier si le jeune s'est recréé un compte"
      )
    }
    if (comptesExistants.length > 1) {
      return ignoree(
        RaisonIgnoree.PLUSIEURS_COMPTES,
        `Plusieurs comptes correspondent à l'archive : ${comptesExistants.map(({ id }) => id).join(', ')}`
      )
    }

    const [compte] = comptesExistants
    if (!compte) {
      return { type: 'RECREATION' }
    }
    if (compte.structure !== archive.structure) {
      return ignoree(
        RaisonIgnoree.AUTRE_STRUCTURE,
        `Le compte ${compte.id} est de structure ${compte.structure}, incompatible avec l'archive (${archive.structure})`
      )
    }
    if (compte.idConseiller && compte.idConseiller !== conseiller.id) {
      return ignoree(
        RaisonIgnoree.AUTRE_CONSEILLER,
        `Le compte ${compte.id} est suivi par un autre conseiller (${compte.idConseiller})`
      )
    }
    return {
      type: 'FUSION',
      idJeune: compte.id,
      rattacherAuConseiller: !compte.idConseiller
    }
  }

  function ignoree(raison: RaisonIgnoree, message: string): Cible {
    return { type: 'IGNOREE', raison, message }
  }
}

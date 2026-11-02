import { Action } from './action'

export interface Qualification {
  code: Qualification.Code
  heures?: number
  commentaire?: string
}

export namespace Qualification {
  export enum Code {
    SANTE = 'SANTE',
    PROJET_PROFESSIONNEL = 'PROJET_PROFESSIONNEL',
    LOGEMENT = 'LOGEMENT',
    CITOYENNETE = 'CITOYENNETE',
    EMPLOI = 'EMPLOI',
    CULTURE_SPORT_LOISIRS = 'CULTURE_SPORT_LOISIRS',
    FORMATION = 'FORMATION',
    NON_SNP = 'NON_SNP'
  }

  export enum Etat {
    A_QUALIFIER = 'A_QUALIFIER',
    NON_QUALIFIABLE = 'NON_QUALIFIABLE',
    QUALIFIEE = 'QUALIFIEE'
  }

  export const mapCodeTypeQualification: Record<Code, TypeQualification> = {
    EMPLOI: {
      code: Code.EMPLOI,
      label: 'Emploi',
      heures: 3
    },
    PROJET_PROFESSIONNEL: {
      code: Code.PROJET_PROFESSIONNEL,
      label: 'Projet Professionnel',
      heures: 2
    },
    CULTURE_SPORT_LOISIRS: {
      code: Code.CULTURE_SPORT_LOISIRS,
      label: 'Loisir, sport, culture',
      heures: 2
    },
    CITOYENNETE: {
      code: Code.CITOYENNETE,
      label: 'Citoyenneté',
      heures: 2
    },
    FORMATION: {
      code: Code.FORMATION,
      label: 'Formation',
      heures: 3
    },
    LOGEMENT: {
      code: Code.LOGEMENT,
      label: 'Logement',
      heures: 2
    },
    SANTE: {
      code: Code.SANTE,
      label: 'Santé',
      heures: 2
    },
    NON_SNP: {
      code: Code.NON_SNP,
      label: 'Action non SNP',
      heures: 0
    }
  }

  export interface TypeQualification {
    code: Code
    label: string
    heures: number
  }

  export function buildCommentaire(
    action: Action,
    codeQualification: Qualification.Code,
    commentaireQualification?: string
  ): string | undefined {
    const estSNP = codeQualification !== Action.Qualification.Code.NON_SNP

    if (!estSNP) {
      return undefined
    }
    if (!commentaireQualification) {
      return tronquerEnOctets(
        [action.contenu, action.description].join(' - '),
        TAILLE_MAX_COMMENTAIRE_EN_OCTETS
      )
    }
    return tronquerEnOctets(
      commentaireQualification,
      TAILLE_MAX_COMMENTAIRE_EN_OCTETS
    )
  }
}

const TAILLE_MAX_COMMENTAIRE_EN_OCTETS = 255

function tronquerEnOctets(texte: string, tailleMaxEnOctets: number): string {
  let tailleEnOctets = 0
  let texteTronque = ''
  for (const caractere of texte) {
    tailleEnOctets += Buffer.byteLength(caractere, 'utf8')
    if (tailleEnOctets > tailleMaxEnOctets) break
    texteTronque += caractere
  }
  return texteTronque
}

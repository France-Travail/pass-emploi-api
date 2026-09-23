import { DateTime } from 'luxon'
import { Profil } from './profil'

export interface Questionnaire {
  structure: Profil.Structure
  situation: Questionnaire.Situation
  besoins: Questionnaire.Besoin[]
  contraintes: Questionnaire.Contrainte[]
  dateNaissance?: DateTime
  communeResidence?: Questionnaire.Commune
  communeRecherche?: Questionnaire.Commune
}

export namespace Questionnaire {
  export enum Situation {
    COLLEGE = 'COLLEGE',
    LYCEE = 'LYCEE',
    ETUDES_SUPERIEURES = 'ETUDES_SUPERIEURES',
    EMPLOI = 'EMPLOI',
    AUTRE = 'AUTRE'
  }

  export enum Besoin {
    ORIENTER = 'ORIENTER',
    DECOUVRIR_METIERS = 'DECOUVRIR_METIERS',
    FORMER = 'FORMER',
    STAGE_IMMERSION = 'STAGE_IMMERSION',
    ALTERNANCE = 'ALTERNANCE',
    EMPLOI = 'EMPLOI',
    ENGAGER = 'ENGAGER',
    MOBILITE_INTERNATIONALE = 'MOBILITE_INTERNATIONALE',
    ACCOMPAGNE = 'ACCOMPAGNE',
    CREER_ACTIVITE = 'CREER_ACTIVITE',
    VIE_QUOTIDIENNE = 'VIE_QUOTIDIENNE'
  }

  // AUTRE et RIEN_NE_ME_BLOQUE n'ont jamais de solution dans le référentiel
  export enum Contrainte {
    PAS_DE_PERMIS = 'PAS_DE_PERMIS',
    PAS_DE_TRANSPORT = 'PAS_DE_TRANSPORT',
    PAS_DE_LOGEMENT = 'PAS_DE_LOGEMENT',
    MANQUE_CONFIANCE = 'MANQUE_CONFIANCE',
    FIN_DE_MOIS = 'FIN_DE_MOIS',
    PAS_DE_DIPLOME = 'PAS_DE_DIPLOME',
    PEU_EXPERIENCE = 'PEU_EXPERIENCE',
    HANDICAP = 'HANDICAP',
    SANTE = 'SANTE',
    GARDE_ENFANT = 'GARDE_ENFANT',
    NUMERIQUE = 'NUMERIQUE',
    FRANCAIS = 'FRANCAIS',
    AUTRE = 'AUTRE',
    RIEN_NE_ME_BLOQUE = 'RIEN_NE_ME_BLOQUE'
  }

  export interface Commune {
    codeInsee: string
    nom: string
  }

  // RIEN_NE_ME_BLOQUE est exclusif : accompagné d'une autre contrainte, il est
  // réduit au seul RIEN_NE_ME_BLOQUE
  export function calculerContraintes(contraintes: Contrainte[]): Contrainte[] {
    if (contraintes.includes(Contrainte.RIEN_NE_ME_BLOQUE)) {
      return [Contrainte.RIEN_NE_ME_BLOQUE]
    }

    return Array.from(new Set(contraintes))
  }

  export function calculerAge(
    questionnaire: Questionnaire,
    maintenant: DateTime
  ): number | undefined {
    const naissance = questionnaire.dateNaissance
    if (!naissance?.isValid) return undefined
    const naissanceUtc = DateTime.utc(
      naissance.year,
      naissance.month,
      naissance.day
    )
    return Math.floor(maintenant.toUTC().diff(naissanceUtc, 'years').years)
  }

  export function calculerDepartement(
    questionnaire: Questionnaire
  ): string | undefined {
    const codeInsee =
      questionnaire.communeRecherche?.codeInsee ??
      questionnaire.communeResidence?.codeInsee
    if (!codeInsee) return undefined
    return codeInsee.startsWith('97') || codeInsee.startsWith('98')
      ? codeInsee.slice(0, 3)
      : codeInsee.slice(0, 2)
  }
}

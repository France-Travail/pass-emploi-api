import { Profil } from '../profil'
import { Questionnaire } from './questionnaire'

export const ReferentielPlanActionRepositoryToken =
  'ReferentielPlanActionRepositoryToken'

// Référentiel « services et solutions » du plan d'action, édité par le métier
// dans un document Grist et synchronisé en base par un cron mensuel
export namespace ReferentielPlanAction {
  export enum TypeSolution {
    LIEN = 'LIEN',
    NAVIGATION = 'NAVIGATION',
    CONSEIL = 'CONSEIL'
  }

  // Écrans de l'app atteignables depuis une solution de type NAVIGATION
  export enum Destination {
    OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
    OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
    OFFRES_EMPLOI = 'OFFRES_EMPLOI',
    ALLER_VERS = 'ALLER_VERS',
    EVENEMENTS = 'EVENEMENTS'
  }

  export interface Service {
    id: string
    nom: string
    description?: string
  }

  // Correspondances vers une démarche France Travail et une action Mission
  // Locale, entretenues par le métier et pas encore exploitées
  export interface ConversionFT {
    thematique?: string
    demarche?: string
    codePourquoi?: string
    codeQuoi?: string
  }

  export interface ConversionML {
    categorie?: string
    codeCategorie?: string
    action?: string
    origine?: string
  }

  // Une ligne du référentiel. Elle porte un besoin OU une contrainte, jamais
  // les deux. Une liste de ciblage vide vaut « pas de filtre »
  export interface Solution {
    id: string
    besoin?: Questionnaire.Besoin
    contrainte?: Questionnaire.Contrainte
    sousCategorie?: string
    besoinExprime?: string

    type: TypeSolution
    libelle: string
    url?: string
    ecranApp?: Destination
    service?: Service

    situations: Questionnaire.Situation[]
    authentifications: Profil.Structure[]
    territoires: string[]
    ageMin?: number
    ageMax?: number
    domaine?: string

    conversionFT?: ConversionFT
    conversionML?: ConversionML
  }

  export interface Diff {
    nbCreees: number
    nbMisesAJour: number
    nbDesactivees: number
  }

  export interface Anomalies {
    nbServicesNonResolus: number
    nbDoublonsServices: number
    nbDoublonsSolutions: number
    nbSolutionsEcartees: number
    nbValeursNonReconnues: number
  }

  export interface Reconciliation {
    services: Service[]
    solutions: Solution[]
    anomalies: Anomalies
  }

  // Garde-fou contre un Grist tronqué : au-delà, la synchronisation échoue
  // plutôt que de vider le référentiel servi aux jeunes
  export interface PlafondDesactivations {
    pourcentageMax: number
    nombreMin: number
  }

  export interface Repository {
    remplacer(
      services: Service[],
      solutions: Solution[],
      plafond: PlafondDesactivations,
      options: { dryRun: boolean }
    ): Promise<Diff>

    trouverSolutionsActives(): Promise<Solution[]>
  }
}

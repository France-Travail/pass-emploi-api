import { Profil } from '../profil'
import { PlanAction } from './plan-action'

export const ReferentielPlanActionRepositoryToken =
  'ReferentielPlanActionRepositoryToken'

export namespace ReferentielPlanAction {
  export interface Service {
    id: string
    nom: string
    description?: string
  }

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

  export interface Solution {
    id: string
    besoin?: PlanAction.Besoin
    contrainte?: PlanAction.Contrainte
    sousCategorie?: string
    besoinExprime?: string

    type: PlanAction.TypeTache
    libelle: string
    url?: string
    ecranApp?: PlanAction.Destination
    service?: Service

    situations: string[]
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
  }

  export interface Reconciliation {
    services: Service[]
    solutions: Solution[]
    anomalies: Anomalies
  }

  export interface PlafondDesactivations {
    pourcentageMax: number
    nombreMin: number
  }

  export interface Repository {
    remplacer(
      services: Service[],
      solutions: Solution[],
      plafond: PlafondDesactivations
    ): Promise<Diff>

    trouverSolutions(ids: string[]): Promise<Solution[]>
  }
}

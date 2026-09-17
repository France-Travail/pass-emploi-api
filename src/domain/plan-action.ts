import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../utils/date-service'
import { IdService } from '../utils/id-service'
import { Profil } from './profil'

export const PlanActionCatalogueRepositoryToken =
  'PlanActionCatalogueRepositoryToken'

export namespace PlanAction {
  export enum Situation {
    COLLEGE = 'COLLEGE',
    LYCEE = 'LYCEE',
    ETUDES_SUPERIEURES = 'ETUDES_SUPERIEURES',
    EMPLOI = 'EMPLOI',
    AUTRE = 'AUTRE'
  }

  export enum Objectif {
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

  // RIEN_NE_ME_BLOQUE est exclusif : combiné à un autre obstacle, il est réduit au seul RIEN_NE_ME_BLOQUE par le mapper
  // AUTRE et RIEN_NE_ME_BLOQUE n'ont jamais de solution dans le référentiel
  export enum Obstacle {
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

  export interface QuestionnaireJeune {
    structure: Profil.Structure
    situation: Situation
    objectifs: Objectif[]
    obstacles: Obstacle[]
    dateNaissance?: DateTime
    communeResidence?: Commune
    communeRecherche?: Commune
  }

  export type TypeSolution = 'link' | 'app' | 'advice'

  // Une ligne du référentiel « services et solutions » (vocabulaire du back
  // office Grist), réduite aux colonnes que l'app exploite. Une solution
  // porte un objectif (category) OU un obstacle (blocker), jamais les deux.
  // Une liste vide vaut « pas de filtre »
  export interface Solution {
    id: string
    category: Objectif | null
    blocker: Obstacle | null
    situations: Situation[]
    structures: Profil.Structure[]
    minAge: number | null
    maxAge: number | null
    // Liste de départements (« 75, 93 ») ou « Territoires d'Outre-mer »
    territory: string | null
    kind: TypeSolution
    label: string
    url: string | null
    serviceName: string | null
  }

  export interface ObjectifPlan {
    id: string
    titre: string
    theme: Objectif | Obstacle
    solutions: Solution[]
  }

  export interface Plan {
    id: string
    objectifs: ObjectifPlan[]
  }

  export interface CatalogueRepository {
    getSolutions(): Solution[]
  }

  export function calculerAge(
    questionnaire: QuestionnaireJeune,
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
    questionnaire: QuestionnaireJeune
  ): string | undefined {
    const codeInsee =
      questionnaire.communeRecherche?.codeInsee ??
      questionnaire.communeResidence?.codeInsee
    if (!codeInsee) return undefined
    return codeInsee.startsWith('97') || codeInsee.startsWith('98')
      ? codeInsee.slice(0, 3)
      : codeInsee.slice(0, 2)
  }

  export function filtrerSolutionsEligibles(args: {
    questionnaire: QuestionnaireJeune
    solutions: Solution[]
    maintenant: DateTime
  }): Solution[] {
    const { questionnaire, solutions, maintenant } = args
    const age = calculerAge(questionnaire, maintenant)
    return solutions.filter(
      solution =>
        matchTheme(questionnaire, solution) &&
        matchStructure(questionnaire, solution) &&
        matchSituation(questionnaire, solution) &&
        matchAge(age, solution) &&
        matchTerritoire(questionnaire, solution)
    )
  }

  function matchTheme(
    questionnaire: QuestionnaireJeune,
    solution: Solution
  ): boolean {
    const repondAUnObjectifDuJeune =
      solution.category !== null &&
      questionnaire.objectifs.includes(solution.category)
    const leveUnObstacleDuJeune =
      solution.blocker !== null &&
      questionnaire.obstacles.includes(solution.blocker)

    return repondAUnObjectifDuJeune || leveUnObstacleDuJeune
  }

  function matchStructure(
    questionnaire: QuestionnaireJeune,
    solution: Solution
  ): boolean {
    return (
      solution.structures.length === 0 ||
      solution.structures.includes(questionnaire.structure)
    )
  }

  function matchSituation(
    questionnaire: QuestionnaireJeune,
    solution: Solution
  ): boolean {
    return (
      solution.situations.length === 0 ||
      solution.situations.includes(questionnaire.situation)
    )
  }

  function matchAge(age: number | undefined, solution: Solution): boolean {
    if (age === undefined) return true
    if (solution.minAge !== null && age < solution.minAge) return false
    if (solution.maxAge !== null && age > solution.maxAge) return false
    return true
  }

  function matchTerritoire(
    questionnaire: QuestionnaireJeune,
    solution: Solution
  ): boolean {
    if (!solution.territory) return true
    const departement = calculerDepartement(questionnaire)
    if (!departement) return false
    const territoire = solution.territory.toLowerCase()
    if (territoire.includes('outre-mer'))
      return departement.startsWith('97') || departement.startsWith('98')
    // Comparaison en minuscules pour la Corse (2A/2B) : le POC comparait le
    // département en majuscules à un territoire minusculisé et ne matchait jamais ces deux codes
    return territoire
      .split(/[,;]/)
      .map(code => code.trim())
      .includes(departement.toLowerCase())
  }

  export const TITRES_OBJECTIFS: Record<Objectif, string> = {
    ORIENTER: "Je cherche à m'orienter",
    DECOUVRIR_METIERS: 'Découvrir des métiers',
    FORMER: 'Me former, me qualifier',
    STAGE_IMMERSION: 'Un stage ou une immersion',
    ALTERNANCE: 'Trouver une alternance',
    EMPLOI: 'Trouver un emploi',
    ENGAGER: "M'engager",
    MOBILITE_INTERNATIONALE: 'Ma mobilité internationale',
    ACCOMPAGNE: 'Être accompagné dans mes démarches',
    CREER_ACTIVITE: 'Créer mon activité',
    VIE_QUOTIDIENNE: 'Ma vie quotidienne'
  }

  export const TITRES_OBSTACLES: Record<Obstacle, string> = {
    PAS_DE_PERMIS: 'Passer mon permis',
    PAS_DE_TRANSPORT: 'Me déplacer plus facilement',
    PAS_DE_LOGEMENT: 'Trouver un logement',
    MANQUE_CONFIANCE: 'Ma confiance en moi',
    FIN_DE_MOIS: 'Boucler mes fins de mois',
    PAS_DE_DIPLOME: 'Valider mon expérience',
    PEU_EXPERIENCE: 'Gagner en expérience',
    HANDICAP: 'Être accompagné avec mon handicap',
    SANTE: 'Prendre soin de ma santé',
    GARDE_ENFANT: 'Faire garder mon enfant',
    NUMERIQUE: 'Le numérique',
    FRANCAIS: 'Progresser en français',
    AUTRE: 'Lever mes blocages',
    RIEN_NE_ME_BLOQUE: 'Rien ne me bloque'
  }

  // Regroupe les solutions éligibles par objectif puis par obstacle du jeune
  // (ids objective-1, objective-2 : l'app y rattache les actions cochées)
  export function construirePlan(args: {
    questionnaire: QuestionnaireJeune
    solutionsEligibles: Solution[]
    id: string
  }): Plan {
    const { questionnaire, solutionsEligibles, id } = args
    const objectifs: ObjectifPlan[] = []

    function ajouterObjectif(
      theme: Objectif | Obstacle,
      titre: string,
      solutions: Solution[]
    ): void {
      if (solutions.length === 0) return
      objectifs.push({
        id: `objective-${objectifs.length + 1}`,
        titre,
        theme,
        solutions
      })
    }

    for (const objectif of new Set(questionnaire.objectifs)) {
      ajouterObjectif(
        objectif,
        TITRES_OBJECTIFS[objectif],
        solutionsEligibles.filter(solution => solution.category === objectif)
      )
    }
    for (const obstacle of new Set(questionnaire.obstacles)) {
      ajouterObjectif(
        obstacle,
        TITRES_OBSTACLES[obstacle],
        solutionsEligibles.filter(solution => solution.blocker === obstacle)
      )
    }

    return { id, objectifs }
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(PlanActionCatalogueRepositoryToken)
      private readonly catalogue: CatalogueRepository,
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    genererPlan(questionnaire: QuestionnaireJeune): Plan {
      const solutionsEligibles = filtrerSolutionsEligibles({
        questionnaire,
        solutions: this.catalogue.getSolutions(),
        maintenant: this.dateService.now()
      })
      return construirePlan({
        questionnaire,
        solutionsEligibles,
        id: this.idService.uuid()
      })
    }
  }
}

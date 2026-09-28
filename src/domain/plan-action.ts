import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../utils/date-service'
import { IdService } from '../utils/id-service'
import { Profil } from './profil'
import { Questionnaire } from './questionnaire'

export const PlanActionCatalogueRepositoryToken =
  'PlanActionCatalogueRepositoryToken'

export namespace PlanAction {
  export type TypeSolution = 'link' | 'app' | 'advice'

  // Une ligne du référentiel « services et solutions » (vocabulaire du back
  // office Grist), réduite aux colonnes que l'app exploite. Une solution
  // porte un besoin (category) OU une contrainte (blocker), jamais les deux.
  // Une liste vide vaut « pas de filtre »
  export interface Solution {
    id: string
    category: Questionnaire.Besoin | null
    blocker: Questionnaire.Contrainte | null
    situations: Questionnaire.Situation[]
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
    theme: Questionnaire.Besoin | Questionnaire.Contrainte
    solutions: Solution[]
  }

  export interface Plan {
    id: string
    objectifs: ObjectifPlan[]
  }

  export interface CatalogueRepository {
    getSolutions(): Solution[]
  }

  export function filtrerSolutionsEligibles(args: {
    questionnaire: Questionnaire
    solutions: Solution[]
    maintenant: DateTime
  }): Solution[] {
    const { questionnaire, solutions, maintenant } = args
    const age = Questionnaire.calculerAge(questionnaire, maintenant)
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
    questionnaire: Questionnaire,
    solution: Solution
  ): boolean {
    const repondAUnBesoinDuJeune =
      solution.category !== null &&
      questionnaire.besoins.includes(solution.category)
    const leveUneContrainteDuJeune =
      solution.blocker !== null &&
      questionnaire.contraintes.includes(solution.blocker)

    return repondAUnBesoinDuJeune || leveUneContrainteDuJeune
  }

  function matchStructure(
    questionnaire: Questionnaire,
    solution: Solution
  ): boolean {
    return (
      solution.structures.length === 0 ||
      solution.structures.includes(questionnaire.structure)
    )
  }

  function matchSituation(
    questionnaire: Questionnaire,
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
    questionnaire: Questionnaire,
    solution: Solution
  ): boolean {
    if (!solution.territory) return true
    const departement = Questionnaire.calculerDepartement(questionnaire)
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

  export const TITRES_BESOINS: Record<Questionnaire.Besoin, string> = {
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

  export const TITRES_CONTRAINTES: Record<Questionnaire.Contrainte, string> = {
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

  // Regroupe les solutions éligibles par besoin puis par contrainte du jeune
  // (ids objective-1, objective-2 : l'app y rattache les actions cochées)
  export function construirePlan(args: {
    questionnaire: Questionnaire
    solutionsEligibles: Solution[]
    id: string
  }): Plan {
    const { questionnaire, solutionsEligibles, id } = args
    const objectifs: ObjectifPlan[] = []

    function ajouterObjectif(
      theme: Questionnaire.Besoin | Questionnaire.Contrainte,
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

    for (const besoin of new Set(questionnaire.besoins)) {
      ajouterObjectif(
        besoin,
        TITRES_BESOINS[besoin],
        solutionsEligibles.filter(solution => solution.category === besoin)
      )
    }
    for (const contrainte of new Set(questionnaire.contraintes)) {
      ajouterObjectif(
        contrainte,
        TITRES_CONTRAINTES[contrainte],
        solutionsEligibles.filter(solution => solution.blocker === contrainte)
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

    genererPlan(questionnaire: Questionnaire): Plan {
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

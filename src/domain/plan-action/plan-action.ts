import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../../utils/date-service'
import { IdService } from '../../utils/id-service'
import { Questionnaire } from './questionnaire'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from './referentiel-plan-action'

export namespace PlanAction {
  export interface Objectif {
    id: string
    titre: string
    theme: Questionnaire.Besoin | Questionnaire.Contrainte
    solutions: ReferentielPlanAction.Solution[]
  }

  export interface Plan {
    id: string
    objectifs: Objectif[]
  }

  export function filtrerSolutionsEligibles(args: {
    questionnaire: Questionnaire
    solutions: ReferentielPlanAction.Solution[]
    maintenant: DateTime
  }): ReferentielPlanAction.Solution[] {
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
    solution: ReferentielPlanAction.Solution
  ): boolean {
    const repondAUnBesoinDuJeune =
      solution.besoin !== undefined &&
      questionnaire.besoins.includes(solution.besoin)
    const leveUneContrainteDuJeune =
      solution.contrainte !== undefined &&
      questionnaire.contraintes.includes(solution.contrainte)

    return repondAUnBesoinDuJeune || leveUneContrainteDuJeune
  }

  function matchStructure(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    return (
      solution.authentifications.length === 0 ||
      solution.authentifications.includes(questionnaire.structure)
    )
  }

  function matchSituation(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    return (
      solution.situations.length === 0 ||
      solution.situations.includes(questionnaire.situation)
    )
  }

  function matchAge(
    age: number | undefined,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    if (age === undefined) return true
    if (solution.ageMin !== undefined && age < solution.ageMin) return false
    if (solution.ageMax !== undefined && age > solution.ageMax) return false
    return true
  }

  function matchTerritoire(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    if (!solution.territoires.length) return true
    const departement = Questionnaire.calculerDepartement(questionnaire)
    if (!departement) return false
    // Comparaison en minuscules pour la Corse (2A/2B) : le POC comparait le
    // département en majuscules à un territoire minusculisé et ne matchait jamais ces deux codes
    return solution.territoires
      .flatMap(territoire => territoire.split(','))
      .map(territoire => territoire.trim().toLowerCase())
      .some(territoire =>
        territoire.includes('outre-mer')
          ? departement.startsWith('97') || departement.startsWith('98')
          : territoire === departement.toLowerCase()
      )
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
    solutionsEligibles: ReferentielPlanAction.Solution[]
    id: string
  }): Plan {
    const { questionnaire, solutionsEligibles, id } = args
    const objectifs: Objectif[] = []

    function ajouterObjectif(
      theme: Questionnaire.Besoin | Questionnaire.Contrainte,
      titre: string,
      solutions: ReferentielPlanAction.Solution[]
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
        solutionsEligibles.filter(solution => solution.besoin === besoin)
      )
    }
    for (const contrainte of new Set(questionnaire.contraintes)) {
      ajouterObjectif(
        contrainte,
        TITRES_CONTRAINTES[contrainte],
        solutionsEligibles.filter(
          solution => solution.contrainte === contrainte
        )
      )
    }

    return { id, objectifs }
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(ReferentielPlanActionRepositoryToken)
      private readonly referentiel: ReferentielPlanAction.Repository,
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    async genererPlan(questionnaire: Questionnaire): Promise<Plan> {
      const solutionsEligibles = filtrerSolutionsEligibles({
        questionnaire,
        solutions: await this.referentiel.trouverSolutionsActives(),
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

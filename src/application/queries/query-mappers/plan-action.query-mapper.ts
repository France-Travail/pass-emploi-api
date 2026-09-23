import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import {
  ActionPlanQueryModel,
  DestinationActionPlan,
  PlanActionConnecteQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../query-models/plan-action.query-model'

export function toPlanActionQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[],
  suggestion: PlanAction.Suggestion
): PlanActionQueryModel {
  return {
    id: plan.id,
    accroche: suggestion.accroche,
    genereLe: suggestion.genereLe.toISO()!,
    generateur: suggestion.generateur,
    objectives: toObjectives(plan, solutions)
  }
}

export function toPlanActionConnecteQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[]
): PlanActionConnecteQueryModel {
  return {
    id: plan.id,
    objectives: toObjectives(plan, solutions)
  }
}

function toObjectives(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[]
): PlanActionQueryModel['objectives'] {
  const parId = new Map(solutions.map(solution => [solution.id, solution]))

  return plan.objectifs
    .map(objectif => ({
      id: objectif.id,
      titre: objectif.titre,
      theme: objectif.theme,
      actions: objectif.taches
        .map(tache => {
          const solution = parId.get(tache.idSolution)
          return solution ? toAction(tache.id, solution) : undefined
        })
        .filter(
          (action): action is ActionPlanQueryModel => action !== undefined
        )
    }))
    .filter(objectif => objectif.actions.length > 0)
}

const TYPE_TACHE_VERS_TYPE_ACTION_PLAN: Record<
  PlanAction.TypeTache,
  TypeActionPlan
> = {
  [PlanAction.TypeTache.LIEN]: TypeActionPlan.LIEN,
  [PlanAction.TypeTache.NAVIGATION]: TypeActionPlan.NAVIGATION,
  [PlanAction.TypeTache.CONSEIL]: TypeActionPlan.CONSEIL
}

const DESTINATION_VERS_DESTINATION_ACTION_PLAN: Record<
  PlanAction.Destination,
  DestinationActionPlan
> = {
  [PlanAction.Destination.OFFRES_ALTERNANCE]:
    DestinationActionPlan.OFFRES_ALTERNANCE,
  [PlanAction.Destination.OFFRES_SERVICE_CIVIQUE]:
    DestinationActionPlan.OFFRES_SERVICE_CIVIQUE,
  [PlanAction.Destination.OFFRES_EMPLOI]: DestinationActionPlan.OFFRES_EMPLOI,
  [PlanAction.Destination.ALLER_VERS]: DestinationActionPlan.ALLER_VERS,
  [PlanAction.Destination.EVENEMENTS]: DestinationActionPlan.EVENEMENTS
}

function toAction(
  idTache: string,
  solution: ReferentielPlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: idTache,
    libelle: solution.libelle,
    type: TYPE_TACHE_VERS_TYPE_ACTION_PLAN[solution.type],
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.ecranApp
      ? {
          destination:
            DESTINATION_VERS_DESTINATION_ACTION_PLAN[solution.ecranApp]
        }
      : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {}),
    ...(solution.service?.description
      ? { descriptionService: solution.service.description }
      : {})
  }
}

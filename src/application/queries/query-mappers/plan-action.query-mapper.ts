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

  return plan.objectifs.map(objectif => ({
    id: objectif.id,
    titre: objectif.titre,
    theme: objectif.theme,
    actions: objectif.taches
      .map(tache => {
        const solution = parId.get(tache.idSolution)
        return solution ? toAction(tache.id, solution) : undefined
      })
      .filter((action): action is ActionPlanQueryModel => action !== undefined)
  }))
}

function toAction(
  idTache: string,
  solution: ReferentielPlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: idTache,
    libelle: solution.libelle,
    type: solution.type as unknown as TypeActionPlan,
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.ecranApp
      ? { destination: solution.ecranApp as unknown as DestinationActionPlan }
      : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {}),
    ...(solution.service?.description
      ? { descriptionService: solution.service.description }
      : {})
  }
}

import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import {
  ActionPlanQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../query-models/plan-action.query-model'

const typeSolutionVersTypeAction: Record<
  ReferentielPlanAction.TypeSolution,
  TypeActionPlan
> = {
  [ReferentielPlanAction.TypeSolution.LIEN]: TypeActionPlan.LIEN,
  [ReferentielPlanAction.TypeSolution.NAVIGATION]: TypeActionPlan.NAVIGATION,
  [ReferentielPlanAction.TypeSolution.CONSEIL]: TypeActionPlan.CONSEIL
}

// L'app reçoit l'identifiant de la tâche, pas celui de la solution : c'est lui
// qui rend la tâche adressable, donc cochable
export function toPlanActionQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[]
): PlanActionQueryModel {
  const parId = new Map(solutions.map(solution => [solution.id, solution]))

  return {
    id: plan.id,
    objectives: plan.objectifs
      .map(objectif => ({
        id: objectif.id,
        titre: objectif.titre,
        theme: objectif.theme,
        // Une solution retirée du référentiel depuis la génération du plan
        // disparaît de l'affichage, et son objectif avec s'il se vide
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
}

function toAction(
  idTache: string,
  solution: ReferentielPlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: idTache,
    libelle: solution.libelle,
    type: typeSolutionVersTypeAction[solution.type],
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {})
  }
}

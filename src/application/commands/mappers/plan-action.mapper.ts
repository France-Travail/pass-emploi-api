import { PlanAction } from '../../../domain/plan-action/plan-action'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import {
  ActionPlanQueryModel,
  ObjectivePlanActionQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../queries/query-models/plan-action.query-model'
import { GenererPlanActionCommand } from '../generer-plan-action.command.handler'

const typeSolutionVersTypeAction: Record<
  ReferentielPlanAction.TypeSolution,
  TypeActionPlan
> = {
  [ReferentielPlanAction.TypeSolution.LIEN]: TypeActionPlan.LIEN,
  [ReferentielPlanAction.TypeSolution.NAVIGATION]: TypeActionPlan.NAVIGATION,
  [ReferentielPlanAction.TypeSolution.CONSEIL]: TypeActionPlan.CONSEIL
}

export function toQuestionnaire(
  command: GenererPlanActionCommand,
  structure: Profil.Structure
): Questionnaire {
  return {
    structure,
    situation: command.situation,
    besoins: command.besoins,
    contraintes: Questionnaire.calculerContraintes(command.contraintes),
    ...(command.dateNaissance ? { dateNaissance: command.dateNaissance } : {}),
    ...(command.communeResidence
      ? { communeResidence: command.communeResidence }
      : {}),
    ...(command.communeRecherche
      ? { communeRecherche: command.communeRecherche }
      : {})
  }
}

// Réponse réduite à ce que l'app affiche : un lien s'ouvre, le reste se coche
export function toPlanActionQueryModel(
  plan: PlanAction.Plan
): PlanActionQueryModel {
  return {
    id: plan.id,
    objectives: plan.objectifs.map(
      (objectif): ObjectivePlanActionQueryModel => ({
        id: objectif.id,
        titre: objectif.titre,
        theme: objectif.theme,
        actions: objectif.solutions.map(toActionPlanQueryModel)
      })
    )
  }
}

function toActionPlanQueryModel(
  solution: ReferentielPlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: solution.id,
    libelle: solution.libelle,
    type: typeSolutionVersTypeAction[solution.type],
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {})
  }
}

import { PlanAction } from '../../../domain/plan-action'
import { Profil } from '../../../domain/profil'
import { Questionnaire } from '../../../domain/questionnaire'
import {
  ActionPlanQueryModel,
  ObjectivePlanActionQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../queries/query-models/plan-action.query-model'
import { GenererPlanActionCommand } from '../generer-plan-action.command.handler'

const kindVersType: Record<PlanAction.TypeSolution, TypeActionPlan> = {
  link: TypeActionPlan.LIEN,
  app: TypeActionPlan.NAVIGATION,
  advice: TypeActionPlan.CONSEIL
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
  solution: PlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: solution.id,
    libelle: solution.label,
    type: kindVersType[solution.kind],
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.serviceName ? { nomService: solution.serviceName } : {})
  }
}

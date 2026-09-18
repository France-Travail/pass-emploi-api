import { PlanAction } from '../../../domain/plan-action'
import { Profil } from '../../../domain/profil'
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
): PlanAction.QuestionnaireJeune {
  return {
    structure,
    situation: command.situation,
    objectifs: command.objectifs,
    obstacles: calculerObstacles(command.obstacles),
    ...(command.dateNaissance ? { dateNaissance: command.dateNaissance } : {}),
    ...(command.communeResidence
      ? { communeResidence: command.communeResidence }
      : {}),
    ...(command.communeRecherche
      ? { communeRecherche: command.communeRecherche }
      : {})
  }
}

function calculerObstacles(
  obstacles: PlanAction.Obstacle[]
): PlanAction.Obstacle[] {
  // RIEN_NE_ME_BLOQUE est exclusif : accompagné d'un autre obstacle, il est
  // réduit au seul RIEN_NE_ME_BLOQUE
  if (obstacles.includes(PlanAction.Obstacle.RIEN_NE_ME_BLOQUE)) {
    return [PlanAction.Obstacle.RIEN_NE_ME_BLOQUE]
  }

  return Array.from(new Set(obstacles))
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

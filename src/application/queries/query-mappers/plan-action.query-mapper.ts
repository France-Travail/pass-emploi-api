import { Profil } from '../../../domain/profil'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import {
  ActionPlanQueryModel,
  EcranAppPlan,
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

const destinationVersEcranApp: Record<
  ReferentielPlanAction.Destination,
  EcranAppPlan
> = {
  [ReferentielPlanAction.Destination.OFFRES_ALTERNANCE]:
    EcranAppPlan.OFFRES_ALTERNANCE,
  [ReferentielPlanAction.Destination.OFFRES_SERVICE_CIVIQUE]:
    EcranAppPlan.OFFRES_SERVICE_CIVIQUE,
  [ReferentielPlanAction.Destination.OFFRES_EMPLOI]: EcranAppPlan.OFFRES_EMPLOI,
  [ReferentielPlanAction.Destination.ALLER_VERS]: EcranAppPlan.ALLER_VERS,
  [ReferentielPlanAction.Destination.EVENEMENTS]: EcranAppPlan.EVENEMENTS,
  [ReferentielPlanAction.Destination.OFFRES_IMMERSIONS]:
    EcranAppPlan.OFFRES_IMMERSIONS
}

// L'app reçoit l'identifiant de la tâche, pas celui de la solution : c'est lui
// qui rend la tâche adressable, donc cochable
export function toPlanActionQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[],
  profil: Profil
): PlanActionQueryModel {
  const mode = PlanAction.modeDeclaration(profil)
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
          .filter(tache => !tache.dateSuppression)
          .map(tache => {
            const solution = parId.get(tache.idSolution)
            return solution ? toAction(tache, solution, mode) : undefined
          })
          .filter(
            (action): action is ActionPlanQueryModel => action !== undefined
          )
      }))
      .filter(objectif => objectif.actions.length > 0)
  }
}

function toAction(
  tache: PlanAction.Tache,
  solution: ReferentielPlanAction.Solution,
  mode: PlanAction.ModeDeclaration
): ActionPlanQueryModel {
  const categorie = categorieAnnoncee(solution, mode)
  const ecranApp = solution.ecranApp
    ? destinationVersEcranApp[solution.ecranApp]
    : undefined
  return {
    id: tache.id,
    idSolution: tache.idSolution,
    libelle: solution.libelle,
    type: typeSolutionVersTypeAction[solution.type],
    terminee: tache.terminee,
    declarationRequise: mode !== PlanAction.ModeDeclaration.AUCUNE,
    ...(solution.url ? { url: solution.url } : {}),
    ...(ecranApp ? { ecranApp } : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {}),
    ...(categorie ? { categorie } : {})
  }
}

function categorieAnnoncee(
  solution: ReferentielPlanAction.Solution,
  mode: PlanAction.ModeDeclaration
): string | undefined {
  switch (mode) {
    case PlanAction.ModeDeclaration.ACTION_MILO:
      return solution.conversionML?.categorie
    case PlanAction.ModeDeclaration.DEMARCHE_FT:
      return solution.conversionFT?.thematique
    case PlanAction.ModeDeclaration.AUCUNE:
      return undefined
  }
}

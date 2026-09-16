import { DateTime } from 'luxon'
import { PlanAction } from '../../../domain/plan-action'
import { estInvite, estMilo, Profil } from '../../../domain/profil'
import {
  CommunePayload,
  GenererPlanActionPayload,
  GoalPayload,
  ObstaclePayload,
  SituationPayload
} from '../../../infrastructure/routes/validation/plan-action.inputs'
import {
  ActionPlanQueryModel,
  ObjectivePlanActionQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../queries/query-models/plan-action.query-model'

// Anticorruption entre le payload HTTP (enums swagger/class-validator) et le
// vocabulaire du référentiel. Les valeurs sont identiques depuis l'alignement
// du contrat avec le POC, les tables restent explicites pour que la prochaine
// divergence se règle ici.

const situationVersDomaine: Record<SituationPayload, PlanAction.Situation> = {
  [SituationPayload.COLLEGE]: 'COLLEGE',
  [SituationPayload.LYCEE]: 'LYCEE',
  [SituationPayload.ETUDES_SUPERIEURES]: 'ETUDES_SUPERIEURES',
  [SituationPayload.EMPLOI]: 'EMPLOI',
  [SituationPayload.AUTRE]: 'AUTRE'
}

const goalVersDomaine: Record<GoalPayload, PlanAction.Envie> = {
  [GoalPayload.ORIENTER]: 'ORIENTER',
  [GoalPayload.DECOUVRIR_METIERS]: 'DECOUVRIR_METIERS',
  [GoalPayload.FORMER]: 'FORMER',
  [GoalPayload.STAGE_IMMERSION]: 'STAGE_IMMERSION',
  [GoalPayload.ALTERNANCE]: 'ALTERNANCE',
  [GoalPayload.EMPLOI]: 'EMPLOI',
  [GoalPayload.ENGAGER]: 'ENGAGER',
  [GoalPayload.MOBILITE_INTERNATIONALE]: 'MOBILITE_INTERNATIONALE',
  [GoalPayload.ACCOMPAGNE]: 'ACCOMPAGNE',
  [GoalPayload.CREER_ACTIVITE]: 'CREER_ACTIVITE',
  [GoalPayload.VIE_QUOTIDIENNE]: 'VIE_QUOTIDIENNE'
}

const obstacleVersDomaine: Record<ObstaclePayload, PlanAction.Blocage> = {
  [ObstaclePayload.PAS_DE_TRANSPORT]: 'PAS_DE_TRANSPORT',
  [ObstaclePayload.PAS_DE_PERMIS]: 'PAS_DE_PERMIS',
  [ObstaclePayload.PAS_DE_LOGEMENT]: 'PAS_DE_LOGEMENT',
  [ObstaclePayload.MANQUE_CONFIANCE]: 'MANQUE_CONFIANCE',
  [ObstaclePayload.FIN_DE_MOIS]: 'FIN_DE_MOIS',
  [ObstaclePayload.GARDE_ENFANT]: 'GARDE_ENFANT',
  [ObstaclePayload.PAS_DE_DIPLOME]: 'PAS_DE_DIPLOME',
  [ObstaclePayload.NUMERIQUE]: 'NUMERIQUE',
  [ObstaclePayload.HANDICAP]: 'HANDICAP',
  [ObstaclePayload.SANTE]: 'SANTE',
  [ObstaclePayload.PEU_EXPERIENCE]: 'PEU_EXPERIENCE',
  [ObstaclePayload.FRANCAIS]: 'FRANCAIS',
  [ObstaclePayload.AUTRE]: 'AUTRE',
  [ObstaclePayload.RIEN_NE_ME_BLOQUE]: 'RIEN_NE_ME_BLOQUE'
}

const kindVersType: Record<PlanAction.TypeSolution, TypeActionPlan> = {
  link: TypeActionPlan.LIEN,
  app: TypeActionPlan.NAVIGATION,
  advice: TypeActionPlan.CONSEIL
}

export function toProfilJeune(
  payload: GenererPlanActionPayload,
  structure: Profil.Structure
): PlanAction.ProfilJeune {
  const dateNaissance = calculerDateNaissance(payload.dateNaissance)

  return {
    authProvider: calculerAuthProvider(structure),
    situation: situationVersDomaine[payload.situation],
    goals: payload.goals.map(goal => goalVersDomaine[goal]),
    obstacles: calculerObstacles(payload.obstacles ?? []),
    ...(dateNaissance !== undefined ? { dateNaissance } : {}),
    ...(payload.habitation
      ? { habitation: toCommune(payload.habitation) }
      : {}),
    ...(payload.villeRecherche
      ? { villeRecherche: toCommune(payload.villeRecherche) }
      : {})
  }
}

function calculerAuthProvider(
  structure: Profil.Structure
): PlanAction.AuthProvider {
  if (estInvite(structure)) return 'guest'
  if (estMilo(structure)) return 'mission-locale'
  return 'france-travail'
}

function calculerObstacles(
  obstaclesPayload: ObstaclePayload[]
): PlanAction.Blocage[] {
  // RIEN_NE_ME_BLOQUE est exclusif : accompagné d'un autre blocage, il est
  // réduit au seul RIEN_NE_ME_BLOQUE
  if (obstaclesPayload.includes(ObstaclePayload.RIEN_NE_ME_BLOQUE)) {
    return [obstacleVersDomaine[ObstaclePayload.RIEN_NE_ME_BLOQUE]]
  }

  return Array.from(
    new Set(obstaclesPayload.map(obstacle => obstacleVersDomaine[obstacle]))
  )
}

function calculerDateNaissance(dateNaissance?: string): string | undefined {
  if (!dateNaissance) return undefined

  // Le domaine attend YYYY-MM-DD, là où IsDateString laisse passer un ISO
  // complet. setZone conserve le décalage écrit dans la chaîne, pour que la
  // date civile ne glisse pas d'un jour au passage dans le fuseau du serveur.
  const date = DateTime.fromISO(dateNaissance, { setZone: true })

  return date.isValid ? date.toISODate()! : undefined
}

function toCommune(commune: CommunePayload): PlanAction.Commune {
  return { codeInsee: commune.codeInsee, nom: commune.nom }
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

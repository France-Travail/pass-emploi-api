import { DateTime } from 'luxon'
import { Core, estInvite, estMilo } from '../../../domain/core'
import {
  ActionDto,
  ActionKindDto,
  AuthProviderDto,
  DeepLinkDto,
  GoalDto,
  LocationDto,
  ObstacleDto,
  PlanDto,
  ProfileDto,
  SituationDto
} from '../../../infrastructure/clients/dto/plan-action.dto'
import {
  ObstaclePayload,
  GenererPlanActionPayload,
  GoalPayload,
  SituationPayload
} from '../../../infrastructure/routes/validation/plan-action.inputs'
import {
  ActionPlanQueryModel,
  DestinationActionPlan,
  ObjectivePlanActionQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../queries/query-models/plan-action.query-model'

const AGE_MIN = 14
const AGE_MAX = 30

const situationVersDto: Record<SituationPayload, SituationDto> = {
  [SituationPayload.COLLEGE]: 'middle-school',
  [SituationPayload.LYCEE]: 'high-school',
  [SituationPayload.ETUDES_SUPERIEURES]: 'higher-education',
  [SituationPayload.EMPLOI]: 'employed',
  [SituationPayload.AUTRE]: 'other'
}

const goalVersDto: Record<GoalPayload, GoalDto | undefined> = {
  [GoalPayload.ORIENTER]: 'orientation',
  [GoalPayload.DECOUVRIR_METIERS]: 'discover-jobs',
  [GoalPayload.FORMER]: 'training',
  [GoalPayload.STAGE_IMMERSION]: 'internship-immersion',
  [GoalPayload.ALTERNANCE]: 'apprenticeship',
  [GoalPayload.EMPLOI]: 'job',
  [GoalPayload.ENGAGER]: 'civic-engagement',
  [GoalPayload.MOBILITE_INTERNATIONALE]: 'international-mobility',
  [GoalPayload.ACCOMPAGNE]: 'guidance-support',
  [GoalPayload.CREER_ACTIVITE]: 'start-business',
  // Aucun équivalent dans le référentiel du service de génération.
  [GoalPayload.VIE_QUOTIDIENNE]: undefined
}

const obstacleVersDto: Record<ObstaclePayload, ObstacleDto | undefined> = {
  [ObstaclePayload.PAS_DE_TRANSPORT]: 'transport',
  // Collision assumée avec PAS_DE_TRANSPORT : le référentiel n'a qu'un seul
  // obstacle transport.
  [ObstaclePayload.PAS_DE_PERMIS]: 'transport',
  [ObstaclePayload.PAS_DE_LOGEMENT]: 'housing',
  [ObstaclePayload.MANQUE_CONFIANCE]: 'confidence',
  [ObstaclePayload.FIN_DE_MOIS]: 'money',
  [ObstaclePayload.GARDE_ENFANT]: 'childcare',
  [ObstaclePayload.PAS_DE_DIPLOME]: 'no-diploma',
  [ObstaclePayload.NUMERIQUE]: 'no-device',
  [ObstaclePayload.HANDICAP]: 'disability',
  [ObstaclePayload.SANTE]: 'health',
  // Aucun équivalent dans le référentiel du service de génération.
  [ObstaclePayload.PEU_EXPERIENCE]: undefined,
  [ObstaclePayload.FRANCAIS]: undefined,
  [ObstaclePayload.AUTRE]: undefined,
  // Exclusif : traité à part dans toProfileDto.
  [ObstaclePayload.RIEN_NE_ME_BLOQUE]: undefined
}

const kindVersType: Record<ActionKindDto, TypeActionPlan> = {
  link: TypeActionPlan.LIEN,
  app: TypeActionPlan.NAVIGATION,
  advice: TypeActionPlan.CONSEIL
}

const deepLinkVersDestination: Record<DeepLinkDto, DestinationActionPlan> = {
  'apprenticeship-offers': DestinationActionPlan.OFFRES_ALTERNANCE,
  'civic-service-offers': DestinationActionPlan.OFFRES_SERVICE_CIVIQUE,
  events: DestinationActionPlan.EVENEMENTS
}

export function toProfileDto(
  payload: GenererPlanActionPayload,
  structure: Core.Structure
): ProfileDto {
  const goals = calculerGoals(payload.goals)
  const obstacles = calculerObstacles(payload.obstacles ?? [])
  const age = calculerAge(payload.dateNaissance)
  const location = calculerLocation(payload)

  return {
    authProvider: calculerAuthProvider(structure),
    situation: situationVersDto[payload.situation],
    goals,
    ...(obstacles.length ? { obstacles } : {}),
    ...(age !== undefined ? { age } : {}),
    ...(payload.domaine !== undefined ? { domain: payload.domaine } : {}),
    ...(location ? { location } : {})
  }
}

function calculerAuthProvider(structure: Core.Structure): AuthProviderDto {
  if (estInvite(structure)) return 'guest'
  if (estMilo(structure)) return 'mission-locale'
  return 'france-travail'
}

function calculerGoals(goalsPayload: GoalPayload[]): GoalDto[] {
  const goals = goalsPayload
    .map(goal => goalVersDto[goal])
    .filter((goal): goal is GoalDto => goal !== undefined)

  return goals.length ? goals : ['dont-know']
}

function calculerObstacles(obstaclesPayload: ObstaclePayload[]): ObstacleDto[] {
  if (obstaclesPayload.includes(ObstaclePayload.RIEN_NE_ME_BLOQUE)) {
    return []
  }

  const obstacles = obstaclesPayload
    .map(obstacle => obstacleVersDto[obstacle])
    .filter((obstacle): obstacle is ObstacleDto => obstacle !== undefined)

  return Array.from(new Set(obstacles))
}

function calculerAge(dateNaissance?: string): number | undefined {
  if (!dateNaissance) return undefined

  const naissance = DateTime.fromISO(dateNaissance)
  const maintenant = DateTime.now()
  const anniversairePasse =
    maintenant.month > naissance.month ||
    (maintenant.month === naissance.month && maintenant.day >= naissance.day)
  const age = maintenant.year - naissance.year - (anniversairePasse ? 0 : 1)

  if (age < AGE_MIN || age > AGE_MAX) return undefined

  return age
}

function calculerLocation(
  payload: GenererPlanActionPayload
): LocationDto | undefined {
  // city/radiusKm décrivent le périmètre de recherche du jeune : villeRecherche.
  // territory conditionne l'éligibilité à des solutions rattachées au lieu de
  // vie : habitation. Repli croisé si l'une des deux communes manque.
  const communeVille = payload.villeRecherche ?? payload.habitation
  const communeTerritoire = payload.habitation ?? payload.villeRecherche

  if (!communeVille && !communeTerritoire) return undefined

  return {
    ...(communeVille ? { city: communeVille.nom } : {}),
    ...(payload.rayonKm !== undefined ? { radiusKm: payload.rayonKm } : {}),
    ...(communeTerritoire
      ? { territory: calculerTerritoire(communeTerritoire.codeInsee) }
      : {})
  }
}

function calculerTerritoire(codeInsee: string): string {
  const longueur = codeInsee.startsWith('97') ? 3 : 2
  return codeInsee.slice(0, longueur)
}

export function toPlanActionQueryModel(plan: PlanDto): PlanActionQueryModel {
  return {
    id: plan.id,
    accroche: plan.greeting,
    genereLe: plan.generatedAt,
    generateur: plan.generator,
    objectives: plan.objectives.map(
      (objective): ObjectivePlanActionQueryModel => ({
        id: objective.id,
        titre: objective.title,
        theme: objective.theme,
        actions: objective.actions.map(toActionPlanQueryModel)
      })
    )
  }
}

function toActionPlanQueryModel(action: ActionDto): ActionPlanQueryModel {
  // deepLink inconnu du proxy : dégradé en CONSEIL, le libellé est conservé,
  // seule la navigation est perdue.
  if (action.deepLink) {
    const destination = deepLinkVersDestination[action.deepLink]
    return destination
      ? {
          id: action.id,
          libelle: action.label,
          type: TypeActionPlan.NAVIGATION,
          destination,
          ...(action.serviceName ? { nomService: action.serviceName } : {})
        }
      : degraderEnConseil(action)
  }

  const type = kindVersType[action.kind]

  // kind inconnu du proxy avec une url exploitable : on ouvre quand même le
  // lien plutôt que de perdre le contenu.
  if (type === TypeActionPlan.LIEN || (!type && action.url)) {
    return toLienQueryModel(action)
  }

  // kind = CONSEIL, kind = NAVIGATION sans deepLink (rien à naviguer), ou kind
  // inconnu sans url exploitable : dégradé en CONSEIL.
  return degraderEnConseil(action)
}

function toLienQueryModel(action: ActionDto): ActionPlanQueryModel {
  return {
    id: action.id,
    libelle: action.label,
    type: TypeActionPlan.LIEN,
    ...(action.url ? { url: action.url } : {}),
    ...(action.serviceName ? { nomService: action.serviceName } : {}),
    ...(action.serviceDescription
      ? { descriptionService: action.serviceDescription }
      : {})
  }
}

function degraderEnConseil(action: ActionDto): ActionPlanQueryModel {
  return {
    id: action.id,
    libelle: action.label,
    type: TypeActionPlan.CONSEIL,
    ...(action.serviceName ? { nomService: action.serviceName } : {})
  }
}

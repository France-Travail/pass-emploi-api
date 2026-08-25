import { DateTime } from 'luxon'
import {
  ActionDto,
  ActionKindDto,
  AuthProviderDto,
  CommuneDto,
  DeepLinkDto,
  GoalDto,
  ObstacleDto,
  PlanDto,
  ProfileDto,
  SituationDto
} from '../../../infrastructure/clients/dto/plan-action.dto'
import {
  ObstaclePayload,
  CommunePayload,
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
import { estInvite, estMilo, Profil } from '../../../domain/profil'

const situationVersDto: Record<SituationPayload, SituationDto> = {
  [SituationPayload.COLLEGE]: 'COLLEGE',
  [SituationPayload.LYCEE]: 'LYCEE',
  [SituationPayload.ETUDES_SUPERIEURES]: 'ETUDES_SUPERIEURES',
  [SituationPayload.EMPLOI]: 'EMPLOI',
  [SituationPayload.AUTRE]: 'AUTRE'
}

const goalVersDto: Record<GoalPayload, GoalDto> = {
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

const obstacleVersDto: Record<ObstaclePayload, ObstacleDto> = {
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
  structure: Profil.Structure
): ProfileDto {
  const dateNaissance = calculerDateNaissance(payload.dateNaissance)

  return {
    authProvider: calculerAuthProvider(structure),
    situation: situationVersDto[payload.situation],
    goals: payload.goals.map(goal => goalVersDto[goal]),
    obstacles: calculerObstacles(payload.obstacles ?? []),
    ...(dateNaissance !== undefined ? { dateNaissance } : {}),
    ...(payload.domaine !== undefined ? { domaine: payload.domaine } : {}),
    ...(payload.habitation
      ? { habitation: toCommuneDto(payload.habitation) }
      : {}),
    ...(payload.villeRecherche
      ? { villeRecherche: toCommuneDto(payload.villeRecherche) }
      : {}),
    ...(payload.rayonKm !== undefined ? { rayonKm: payload.rayonKm } : {})
  }
}

function calculerAuthProvider(structure: Profil.Structure): AuthProviderDto {
  if (estInvite(structure)) return 'guest'
  if (estMilo(structure)) return 'mission-locale'
  return 'france-travail'
}

function calculerObstacles(obstaclesPayload: ObstaclePayload[]): ObstacleDto[] {
  // RIEN_NE_ME_BLOQUE est exclusif côté service : accompagné d'un autre
  // obstacle, il fait échouer la validation du profil.
  if (obstaclesPayload.includes(ObstaclePayload.RIEN_NE_ME_BLOQUE)) {
    return [obstacleVersDto[ObstaclePayload.RIEN_NE_ME_BLOQUE]]
  }

  return Array.from(
    new Set(obstaclesPayload.map(obstacle => obstacleVersDto[obstacle]))
  )
}

function calculerDateNaissance(dateNaissance?: string): string | undefined {
  if (!dateNaissance) return undefined

  // Le service n'accepte que YYYY-MM-DD, là où IsDateString laisse passer un
  // ISO complet. setZone conserve le décalage écrit dans la chaîne, pour que la
  // date civile ne glisse pas d'un jour au passage dans le fuseau du serveur.
  const date = DateTime.fromISO(dateNaissance, { setZone: true })

  return date.isValid ? date.toISODate()! : undefined
}

function toCommuneDto(commune: CommunePayload): CommuneDto {
  return { codeInsee: commune.codeInsee, nom: commune.nom }
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

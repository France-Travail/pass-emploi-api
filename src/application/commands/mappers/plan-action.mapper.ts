import { DateTime } from 'luxon'
import { Core } from '../../../domain/core'
import { PlanAction } from '../../../domain/plan-action'
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

// Anticorruption entre le payload HTTP (enums swagger/class-validator) et le
// vocabulaire du domaine plan-action. Les valeurs sont identiques depuis
// l'alignement du contrat, les tables restent explicites pour que la
// prochaine divergence se règle ici.

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

// Écrans de l'app par valeur de deepLink du référentiel (normalisées en
// français par la sync Grist). Les écrans sans destination dans l'app
// (offres-emploi, aller-vers, messagerie…) sont dégradés en CONSEIL.
const deepLinkVersDestination: Record<
  string,
  DestinationActionPlan | undefined
> = {
  'offres-alternance': DestinationActionPlan.OFFRES_ALTERNANCE,
  'offres-services-civiques': DestinationActionPlan.OFFRES_SERVICE_CIVIQUE,
  evenements: DestinationActionPlan.EVENEMENTS
}

export function toProfil(
  payload: GenererPlanActionPayload,
  structure: Core.Structure
): PlanAction.Profil {
  const dateNaissance = calculerDateNaissance(payload.dateNaissance)

  return {
    authProvider: PlanAction.authProviderDe(structure),
    situation: situationVersDomaine[payload.situation],
    goals: payload.goals.map(goal => goalVersDomaine[goal]),
    obstacles: calculerObstacles(payload.obstacles ?? []),
    ...(dateNaissance !== undefined ? { dateNaissance } : {}),
    ...(payload.domaine !== undefined ? { domaine: payload.domaine } : {}),
    ...(payload.habitation
      ? { habitation: toCommune(payload.habitation) }
      : {}),
    ...(payload.villeRecherche
      ? { villeRecherche: toCommune(payload.villeRecherche) }
      : {}),
    ...(payload.rayonKm !== undefined ? { rayonKm: payload.rayonKm } : {})
  }
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

export function toPlanActionQueryModel(
  plan: PlanAction.Plan
): PlanActionQueryModel {
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

function toActionPlanQueryModel(
  action: PlanAction.Action
): ActionPlanQueryModel {
  // deepLink sans destination dans l'app : dégradé en CONSEIL, le libellé
  // est conservé, seule la navigation est perdue.
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

  // kind inconnu avec une url exploitable : on ouvre quand même le lien
  // plutôt que de perdre le contenu.
  if (type === TypeActionPlan.LIEN || (!type && action.url)) {
    return toLienQueryModel(action)
  }

  // kind = CONSEIL, kind = NAVIGATION sans deepLink (rien à naviguer), ou
  // kind inconnu sans url exploitable : dégradé en CONSEIL.
  return degraderEnConseil(action)
}

function toLienQueryModel(action: PlanAction.Action): ActionPlanQueryModel {
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

function degraderEnConseil(action: PlanAction.Action): ActionPlanQueryModel {
  return {
    id: action.id,
    libelle: action.label,
    type: TypeActionPlan.CONSEIL,
    ...(action.serviceName ? { nomService: action.serviceName } : {})
  }
}

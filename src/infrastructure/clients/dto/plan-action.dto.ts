// Types du contrat exposé par le service de génération (POC
// bayesimpact/1jeune-des-solutions). Reflète `apps/api/docs/integration.md`
// de ce repo, volontairement non recopié ici car amené à bouger.
//
// Depuis le 2026-07-30 le service a aligné son contrat d'entrée sur le
// vocabulaire du questionnaire mobile : les énumérations sont identiques à
// celles du payload, et les champs portent les mêmes noms français. Les tables
// de correspondance du mapper sont donc l'identité aujourd'hui — elles restent
// explicites pour que la prochaine divergence se règle côté proxy.

export type SituationDto =
  'COLLEGE' | 'LYCEE' | 'ETUDES_SUPERIEURES' | 'EMPLOI' | 'AUTRE'

export type GoalDto =
  | 'ORIENTER'
  | 'DECOUVRIR_METIERS'
  | 'FORMER'
  | 'STAGE_IMMERSION'
  | 'ALTERNANCE'
  | 'EMPLOI'
  | 'ENGAGER'
  | 'MOBILITE_INTERNATIONALE'
  | 'ACCOMPAGNE'
  | 'CREER_ACTIVITE'
  | 'VIE_QUOTIDIENNE'

// RIEN_NE_ME_BLOQUE est exclusif : combiné à un autre obstacle, le service
// rejette le profil.
export type ObstacleDto =
  | 'PAS_DE_PERMIS'
  | 'PAS_DE_TRANSPORT'
  | 'PAS_DE_LOGEMENT'
  | 'MANQUE_CONFIANCE'
  | 'FIN_DE_MOIS'
  | 'PAS_DE_DIPLOME'
  | 'PEU_EXPERIENCE'
  | 'HANDICAP'
  | 'SANTE'
  | 'GARDE_ENFANT'
  | 'NUMERIQUE'
  | 'FRANCAIS'
  | 'AUTRE'
  | 'RIEN_NE_ME_BLOQUE'

export type AuthProviderDto = 'france-travail' | 'mission-locale' | 'guest'

export interface CommuneDto {
  codeInsee: string
  nom: string
}

export interface ProfileDto {
  authProvider: AuthProviderDto
  situation: SituationDto
  goals: GoalDto[]
  obstacles: ObstacleDto[]
  dateNaissance?: string
  domaine?: string | null
  habitation?: CommuneDto
  villeRecherche?: CommuneDto
  rayonKm?: number
}

export interface GenererPlanActionRequestDto {
  profile: ProfileDto
  model?: string
}

export type ActionKindDto = 'link' | 'app' | 'advice'

export type DeepLinkDto =
  'apprenticeship-offers' | 'civic-service-offers' | 'events'

export interface ActionDto {
  id: string
  label: string
  kind: ActionKindDto
  url?: string
  deepLink?: DeepLinkDto
  serviceName?: string
  serviceDescription?: string
  done: boolean
}

export interface ObjectiveDto {
  id: string
  title: string
  theme: string
  actions: ActionDto[]
}

export type GeneratorDto = 'llm' | 'fallback'

export interface PlanDto {
  id: string
  greeting: string
  objectives: ObjectiveDto[]
  generatedAt: string
  generator: GeneratorDto
  model?: string
}

export interface GenererPlanActionResponseDto {
  plan: PlanDto
}

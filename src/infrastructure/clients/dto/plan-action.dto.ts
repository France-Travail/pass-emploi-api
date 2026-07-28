// Types du contrat exposé par le service de génération (POC
// bayesimpact/1jeune-des-solutions). Reflète `apps/api/docs/integration.md`
// de ce repo, volontairement non recopié ici car amené à bouger.

export type SituationDto =
  'middle-school' | 'high-school' | 'higher-education' | 'employed' | 'other'

export type GoalDto =
  | 'orientation'
  | 'discover-jobs'
  | 'training'
  | 'internship-immersion'
  | 'apprenticeship'
  | 'job'
  | 'civic-engagement'
  | 'international-mobility'
  | 'guidance-support'
  | 'start-business'
  | 'dont-know'

export type ObstacleDto =
  | 'transport'
  | 'housing'
  | 'confidence'
  | 'money'
  | 'childcare'
  | 'no-diploma'
  | 'no-device'
  | 'disability'
  | 'health'

export type AuthProviderDto = 'france-travail' | 'mission-locale' | 'guest'

export interface LocationDto {
  city?: string
  radiusKm?: number
  territory?: string
}

export interface ProfileDto {
  authProvider: AuthProviderDto
  situation: SituationDto
  goals: GoalDto[]
  obstacles?: ObstacleDto[]
  age?: number
  domain?: string | null
  location?: LocationDto
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

export interface MissionLocaleApprentissageDto {
  nom?: string
  localisation?: { adresse?: string; cp?: string; ville?: string }
  contact?: { telephone?: string }
}

export interface CommuneApprentissageDto {
  nom: string
  code: { insee: string; postaux: string[] }
  mission_locale?: MissionLocaleApprentissageDto | null
}

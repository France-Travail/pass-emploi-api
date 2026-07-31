import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'

export enum SituationPayload {
  COLLEGE = 'COLLEGE',
  LYCEE = 'LYCEE',
  ETUDES_SUPERIEURES = 'ETUDES_SUPERIEURES',
  EMPLOI = 'EMPLOI',
  AUTRE = 'AUTRE'
}

export enum GoalPayload {
  ORIENTER = 'ORIENTER',
  DECOUVRIR_METIERS = 'DECOUVRIR_METIERS',
  FORMER = 'FORMER',
  STAGE_IMMERSION = 'STAGE_IMMERSION',
  ALTERNANCE = 'ALTERNANCE',
  EMPLOI = 'EMPLOI',
  ENGAGER = 'ENGAGER',
  MOBILITE_INTERNATIONALE = 'MOBILITE_INTERNATIONALE',
  ACCOMPAGNE = 'ACCOMPAGNE',
  CREER_ACTIVITE = 'CREER_ACTIVITE',
  VIE_QUOTIDIENNE = 'VIE_QUOTIDIENNE'
}

export enum ObstaclePayload {
  PAS_DE_TRANSPORT = 'PAS_DE_TRANSPORT',
  PAS_DE_PERMIS = 'PAS_DE_PERMIS',
  PAS_DE_LOGEMENT = 'PAS_DE_LOGEMENT',
  MANQUE_CONFIANCE = 'MANQUE_CONFIANCE',
  FIN_DE_MOIS = 'FIN_DE_MOIS',
  GARDE_ENFANT = 'GARDE_ENFANT',
  PAS_DE_DIPLOME = 'PAS_DE_DIPLOME',
  NUMERIQUE = 'NUMERIQUE',
  HANDICAP = 'HANDICAP',
  SANTE = 'SANTE',
  PEU_EXPERIENCE = 'PEU_EXPERIENCE',
  FRANCAIS = 'FRANCAIS',
  AUTRE = 'AUTRE',
  RIEN_NE_ME_BLOQUE = 'RIEN_NE_ME_BLOQUE'
}

export class CommunePayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codeInsee: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom: string
}

export class GenererPlanActionPayload {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dateNaissance?: string

  @ApiProperty({ enum: SituationPayload })
  @IsEnum(SituationPayload)
  situation: SituationPayload

  @ApiProperty({ enum: GoalPayload, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GoalPayload, { each: true })
  goals: GoalPayload[]

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  domaine?: string | null

  @ApiPropertyOptional({ type: CommunePayload })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommunePayload)
  habitation?: CommunePayload

  @ApiPropertyOptional({ type: CommunePayload })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommunePayload)
  villeRecherche?: CommunePayload

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rayonKm?: number

  @ApiPropertyOptional({ enum: ObstaclePayload, isArray: true })
  @IsArray()
  @IsEnum(ObstaclePayload, { each: true })
  @IsOptional()
  obstacles?: ObstaclePayload[]
}

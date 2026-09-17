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
import { PlanAction } from '../../../domain/plan-action'

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

  @ApiProperty({ enum: PlanAction.Situation })
  @IsEnum(PlanAction.Situation)
  situation: PlanAction.Situation

  @ApiProperty({ enum: PlanAction.Objectif, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(PlanAction.Objectif, { each: true })
  goals: PlanAction.Objectif[]

  // Texte libre exploitable seulement par le LLM (permet de personnaliser le plan)
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

  // inexploité, même par le LLM
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rayonKm?: number

  @ApiPropertyOptional({ enum: PlanAction.Obstacle, isArray: true })
  @IsArray()
  @IsEnum(PlanAction.Obstacle, { each: true })
  @IsOptional()
  obstacles?: PlanAction.Obstacle[]
}

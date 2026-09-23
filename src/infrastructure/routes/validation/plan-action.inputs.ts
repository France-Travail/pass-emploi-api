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
import { Questionnaire } from '../../../domain/questionnaire'

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

  @ApiProperty({ enum: Questionnaire.Situation })
  @IsEnum(Questionnaire.Situation)
  situation: Questionnaire.Situation

  @ApiProperty({ enum: Questionnaire.Besoin, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Questionnaire.Besoin, { each: true })
  goals: Questionnaire.Besoin[]

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

  @ApiPropertyOptional({ enum: Questionnaire.Contrainte, isArray: true })
  @IsArray()
  @IsEnum(Questionnaire.Contrainte, { each: true })
  @IsOptional()
  obstacles?: Questionnaire.Contrainte[]
}

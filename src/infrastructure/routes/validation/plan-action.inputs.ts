import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested
} from 'class-validator'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'

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

  @ApiPropertyOptional({ type: CommunePayload, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommunePayload)
  habitation?: CommunePayload | null

  @ApiPropertyOptional({ type: CommunePayload, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommunePayload)
  villeRecherche?: CommunePayload | null

  // inexploité, même par le LLM
  @ApiPropertyOptional({ nullable: true })
  @IsNumber()
  @IsOptional()
  rayonKm?: number | null

  @ApiPropertyOptional({ enum: Questionnaire.Contrainte, isArray: true })
  @IsArray()
  @IsEnum(Questionnaire.Contrainte, { each: true })
  @IsOptional()
  obstacles?: Questionnaire.Contrainte[]
}

export class ChangerStatutTachePlanActionPayload {
  @ApiProperty()
  @IsBoolean()
  terminee: boolean

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Datetime ISO avec décalage UTC, requise pour cocher quand declarationRequise est vrai'
  })
  @IsOptional()
  @IsDateString()
  @Matches(/T.+(Z|[+-]\d{2}:?\d{2})$/, {
    message: 'date doit être un datetime ISO avec décalage UTC'
  })
  date?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  commentaire?: string
}

const THEMES_PLAN_ACTION = {
  ...Questionnaire.Besoin,
  ...Questionnaire.Contrainte
}

export class ActionInvitePlanPayload {
  @ApiProperty()
  @IsUUID()
  id: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idSolution: string

  @ApiProperty()
  @IsBoolean()
  terminee: boolean
}

export class ObjectifInvitePlanPayload {
  @ApiProperty()
  @IsUUID()
  id: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  titre: string

  @ApiProperty({ enum: Object.values(THEMES_PLAN_ACTION) })
  @IsEnum(THEMES_PLAN_ACTION)
  theme: Questionnaire.Besoin | Questionnaire.Contrainte

  @ApiProperty({ type: [ActionInvitePlanPayload] })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ActionInvitePlanPayload)
  actions: ActionInvitePlanPayload[]
}

export class PlanInvitePayload {
  @ApiProperty()
  @IsUUID()
  id: string

  @ApiProperty({ type: [ObjectifInvitePlanPayload] })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ObjectifInvitePlanPayload)
  objectives: ObjectifInvitePlanPayload[]
}

export function toPlanInvite(
  payload: PlanInvitePayload
): PlanAction.PlanInvite {
  return {
    id: payload.id,
    objectifs: payload.objectives.map(objectif => ({
      id: objectif.id,
      titre: objectif.titre,
      theme: objectif.theme,
      taches: objectif.actions.map(action => ({
        id: action.id,
        idSolution: action.idSolution,
        terminee: action.terminee
      }))
    }))
  }
}

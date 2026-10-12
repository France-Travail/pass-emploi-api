import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested
} from 'class-validator'
import { ArchiveJeune } from '../../../domain/archive-jeune'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { RendezVous } from '../../../domain/rendez-vous/rendez-vous'

export class GetRendezVousJeuneQueryParams {
  @IsOptional()
  @IsString()
  @IsEnum(RendezVous.Periode)
  periode?: RendezVous.Periode
}

export class UpdateConfigurationInput {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  registration_token?: string

  @ApiPropertyOptional()
  @IsString()
  @IsTimeZone()
  @IsOptional()
  fuseauHoraire?: string
}

export class ArchiverJeunePayload {
  @ApiProperty({ enum: ArchiveJeune.MotifSuppression })
  @IsString()
  @IsNotEmpty()
  @IsEnum(ArchiveJeune.MotifSuppression)
  motif: ArchiveJeune.MotifSuppression

  @ApiPropertyOptional()
  @ValidateIf(payload => payload.motif === ArchiveJeune.MotifSuppression.AUTRE)
  @IsNotEmpty()
  @IsString()
  @MaxLength(250)
  commentaire?: string

  @IsOptional()
  @IsNotEmpty()
  @IsDateString()
  dateFinAccompagnement?: string
}

export class TransfererConseillerPayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseillerSource: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseillerCible: string

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  idsJeune: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  estTemporaire?: boolean
}

export class UpdateJeunePreferencesPayload {
  @IsOptional()
  @IsBoolean()
  partageFavoris?: boolean
  @IsOptional()
  @IsBoolean()
  alertesOffres?: boolean
  @IsOptional()
  @IsBoolean()
  messages?: boolean
  @IsOptional()
  @IsBoolean()
  creationActionConseiller?: boolean
  @IsOptional()
  @IsBoolean()
  rendezVousSessions?: boolean
  @IsOptional()
  @IsBoolean()
  rappelActions?: boolean
  @IsOptional()
  @IsBoolean()
  actuMilo?: boolean
}

export class UpdateJeunePayload {
  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  dateSignatureCGU?: string
}

export class GetRendezVousJeuneConseillerQueryParams {
  @IsDateString()
  dateDebut: string

  @IsDateString()
  dateFin: string
}

export class GetActionsByJeuneQueryParams {
  @IsDateString()
  dateDebut: string

  @IsDateString()
  dateFin: string
}

export class MaintenantQueryParams {
  @ApiProperty()
  @IsISO8601({ strict: true })
  maintenant: string
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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEnum([
    ...Object.values(Questionnaire.Besoin),
    ...Object.values(Questionnaire.Contrainte)
  ])
  theme: Questionnaire.Besoin | Questionnaire.Contrainte

  @ApiProperty({ type: [ActionInvitePlanPayload] })
  @IsArray()
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
  @ValidateNested({ each: true })
  @Type(() => ObjectifInvitePlanPayload)
  objectives: ObjectifInvitePlanPayload[]
}

export class ReprendreCompteInvitePayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  jetonInvite: string

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanInvitePayload)
  plan?: PlanInvitePayload
}

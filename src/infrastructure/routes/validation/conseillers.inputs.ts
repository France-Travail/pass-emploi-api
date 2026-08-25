import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateNested
} from 'class-validator'
import { TriActionsConseillerV2 } from 'src/application/queries/action/get-actions-conseiller-v2.query.handler.db'
import { TriRendezVous } from 'src/application/queries/rendez-vous/get-rendez-vous-conseiller-pagines.query.handler.db'
import { Action } from 'src/domain/action/action'
import { AgenceInput } from 'src/infrastructure/routes/validation/agences.inputs'
import { ArchiveJeune } from '../../../domain/archive-jeune'
import {
  transformStringToArray,
  transformStringToBoolean
} from './utils/transformers'
import { Profil } from '../../../domain/profil'

export class GetConseillersQueryParams {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  q: string
}

export class CreateJeunePoleEmploiPayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseiller: string
}

export class VerifierEmailBeneficiairePayload {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class CreerJeuneMiloPayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idDossier: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  prenom: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseiller: string

  @ApiProperty({ enum: [Profil.Dispositif.CEJ, Profil.Dispositif.PACEA] })
  @IsString()
  @IsNotEmpty()
  dispositif: Profil.Dispositif.CEJ | Profil.Dispositif.PACEA

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  surcharge?: boolean

  @ApiProperty()
  @IsBoolean()
  peutVoirLeCompteurDesHeures: boolean
}

export class EnvoyerNotificationsPayload {
  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  idsJeunes: string[]
}

export class GetRendezVousConseillerV2QueryParams {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @IsIn([true, false])
  @Transform(params => transformStringToBoolean(params, 'presenceConseiller'))
  presenceConseiller?: boolean

  @IsOptional()
  @IsEnum(TriRendezVous)
  tri?: TriRendezVous

  @IsOptional()
  @IsNotEmpty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateDebut?: Date

  @IsOptional()
  @IsNotEmpty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateFin?: Date
}

export class DetailConseillerPayload {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmptyObject()
  @ValidateNested({ each: true })
  @Type(() => AgenceInput)
  agence?: AgenceInput

  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  dateSignatureCGU?: string

  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  dateVisionnageActus?: string

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  notificationsSonores?: boolean
}

export class ChangerDispositifJeunePayload {
  @ApiProperty({ enum: [Profil.Dispositif.CEJ, Profil.Dispositif.PACEA] })
  @IsIn([Profil.Dispositif.CEJ, Profil.Dispositif.PACEA])
  dispositif: Profil.Dispositif.CEJ | Profil.Dispositif.PACEA

  @ApiProperty({ enum: ArchiveJeune.MotifSuppression })
  @IsEnum(ArchiveJeune.MotifSuppression)
  motif: ArchiveJeune.MotifSuppression

  @ApiProperty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateFinAccompagnement: Date
}

export class UpdateJeuneDuConseillerPayload {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 11)
  idPartenaire?: string

  @ApiProperty({ enum: Profil.Dispositif })
  @IsOptional()
  @IsString()
  @IsEnum(Profil.Dispositif)
  dispositif?: Profil.Dispositif

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  peutVoirLeComptageDesHeures?: boolean
}

export class GetIndicateursPourConseillerQueryParams {
  @ApiProperty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateDebut: Date

  @ApiProperty()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  dateFin: Date
}

export class CreateListeDeDiffusionPayload {
  @ApiProperty()
  @IsString()
  titre: string

  @ApiProperty()
  @IsArray()
  idsBeneficiaires: string[]
}

export class UpdateListeDeDiffusionPayload {
  @ApiProperty()
  @IsString()
  titre: string

  @ApiProperty()
  @IsArray()
  idsBeneficiaires: string[]
}

export class GetActionsConseillerV2QueryParams {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsEnum(Action.Qualification.Code, { each: true })
  @Transform(params => transformStringToArray(params, 'codesCategories'))
  codesCategories?: Action.Qualification.Code[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @IsIn([true, false])
  @Transform(params => transformStringToBoolean(params, 'aQualifier'))
  aQualifier?: boolean

  @IsOptional()
  @IsString()
  @IsEnum(TriActionsConseillerV2)
  tri?: TriActionsConseillerV2
}

export class GetIdentitesJeunesQueryParams {
  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @IsNotEmpty({ each: true })
  @Transform(params => transformStringToArray(params, 'ids'))
  ids: string[]
}

export class GetDemarchesConseillerQueryParams {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  dateDebut?: string
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFin?: string
}

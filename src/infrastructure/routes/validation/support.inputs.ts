import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator'
import { Type } from 'class-transformer'
import { Core } from '../../../domain/core'
import { FeatureFlip } from '../../../domain/feature-flip'
import { Migration } from '../../../domain/migration'
import { Notification } from '../../../domain/notification/notification'
import { Planificateur } from '../../../domain/planificateur'

export class TeleverserCsvPayload {
  @ApiProperty({ type: 'string', format: 'binary' })
  @ValidateIf(() => false)
  fichier: Express.Multer.File
}

export class DesarchiverJeunePayload {
  @ApiPropertyOptional({
    description:
      'ID (en base) du conseiller auquel rattacher le jeune restauré. Requis sauf si idJeuneRecree est fourni.'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idConseiller?: string

  @ApiPropertyOptional({
    description:
      'ID (en base) du compte que le jeune s’est recréé entre-temps. Sa présence bascule en mode fusion : le jeune archivé n’est pas recréé, ses données sont rattachées à ce compte (qui garde son identité, son authentification et son conseiller).'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idJeuneRecree?: string
}

export class RefreshJDDPayload {
  @ApiProperty()
  @IsString()
  idConseiller: string

  @ApiProperty()
  @IsBoolean()
  menage: boolean
}

export class ChangerAgenceConseillerPayload {
  @ApiProperty()
  @IsString()
  idConseiller: string

  @ApiProperty()
  @IsString()
  idNouvelleAgence: string
}

export class ModifierAgenceFTConseillerPayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseiller: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idAgence: string
}

export class FusionnerAgencesPayload {
  @ApiProperty()
  @IsString()
  idAgenceSource: string

  @ApiProperty()
  @IsString()
  idAgenceCible: string
}

export class TransfererJeunesPayload {
  @ApiProperty()
  @IsString()
  idConseillerSource: string

  @ApiProperty()
  @IsString()
  idConseillerCible: string

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  idsJeunes: string[]
}

export class CreerJeuneSupportPayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idConseiller: string

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motif?: string
}

export class SuperviseursPayload {
  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[]
}

export class UpdateFeatureFlipPayload {
  @ApiProperty({
    enum: FeatureFlip.Tag,
    description: Object.values(FeatureFlip.Tag).join(', ')
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(FeatureFlip.Tag)
  tagFeature: FeatureFlip.Tag

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  @IsIn([false, true])
  supprimerExistants?: boolean

  @ApiProperty({ type: String, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailsConseillersAjout?: string[]

  @ApiProperty({ type: String, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailsConseillersSuppression?: string[]
}

export class ListerJobsQueryParams {
  @ApiProperty({
    enum: ['waiting', 'active', 'delayed', 'completed', 'failed', 'paused'],
    description: 'Statut des jobs à lister'
  })
  @IsEnum(['waiting', 'active', 'delayed', 'completed', 'failed', 'paused'])
  statut: Planificateur.StatutJob

  @ApiPropertyOptional({
    enum: Planificateur.JobType,
    description: 'Filtrer par type de job'
  })
  @IsOptional()
  @IsEnum(Planificateur.JobType)
  jobType?: Planificateur.JobType

  @ApiPropertyOptional({
    type: Number,
    description: 'Index de début pour la pagination (défaut : 0)'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  debut?: number

  @ApiPropertyOptional({
    type: Number,
    description: 'Index de fin pour la pagination (défaut : 20)'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fin?: number
}

export class NotifierBeneficiairesPayload {
  @ApiProperty({
    enum: Notification.TypeNotifManuelle,
    description: Object.values(Notification.Type).join(', ')
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(Notification.Type)
  typeNotification: Notification.Type =
    Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT

  @ApiProperty({
    type: String
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  titre: string

  @ApiProperty({
    type: String
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  description: string

  @ApiProperty({
    enum: Core.Structure,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Core.Structure, { each: true })
  structures?: Core.Structure[]

  @ApiPropertyOptional({
    enum: Migration.PhaseDeMigration,
    description: `Tag de feature flip pour cibler les bénéficiaires de la migration. Valeurs possibles : ${Object.values(
      Migration.PhaseDeMigration
    ).join(', ')}`
  })
  @IsOptional()
  @IsString()
  @IsEnum(Migration.PhaseDeMigration)
  phaseDeMigration?: Migration.PhaseDeMigration

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @IsIn([true, false])
  push: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Max(10000)
  batchSize?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  minutesEntreLesBatchs?: number
}

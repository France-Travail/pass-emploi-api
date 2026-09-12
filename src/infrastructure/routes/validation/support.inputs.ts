import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'
import { Profil } from '../../../domain/profil'
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

export class CreerFonctionnalitePayload {
  @ApiProperty({
    description:
      'Identifiant de la fonctionnalité, choisi à la création. Rejouer la route avec le même id ne change rien.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string
}

export class AjouterConseillersFonctionnalitePayload {
  @ApiProperty({ description: "Identifiant d'une fonctionnalité existante" })
  @IsString()
  @IsNotEmpty()
  id: string

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emailConseillers: string[]

  @ApiPropertyOptional({
    description:
      'Date à partir de laquelle la fonctionnalité est active pour ces conseillers. Absente = active immédiatement. Rejouer la route sur un conseiller déjà affecté remplace sa date.'
  })
  @IsOptional()
  @IsISO8601()
  dateActivation?: string
}

export class SupprimerConseillersFonctionnalitePayload {
  @ApiProperty({ description: "Identifiant d'une fonctionnalité existante" })
  @IsString()
  @IsNotEmpty()
  id: string

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Requis sauf si supprimerTousLesConseillers vaut true'
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailConseillers?: string[]

  @ApiPropertyOptional({
    description: 'Retire tous les conseillers de la fonctionnalité'
  })
  @IsOptional()
  @IsBoolean()
  @IsIn([false, true])
  supprimerTousLesConseillers?: boolean
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

export class StructureEtDispositifsPayload {
  @ApiProperty({ enum: Profil.Structure })
  @IsEnum(Profil.Structure)
  structure: Profil.Structure

  @ApiPropertyOptional({
    enum: Profil.Dispositif,
    isArray: true,
    description: 'Absent = tous les dispositifs de la structure'
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Profil.Dispositif, { each: true })
  dispositifs?: Profil.Dispositif[]
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

  @ApiPropertyOptional({
    type: StructureEtDispositifsPayload,
    isArray: true,
    description: 'Cibles de la notification, absent = tous les bénéficiaires'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructureEtDispositifsPayload)
  structuresEtDispositifs?: StructureEtDispositifsPayload[]

  @ApiPropertyOptional({
    description:
      "Id d'une vague de migration (table `migration`) pour ne cibler que ses bénéficiaires"
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phaseDeMigration?: string

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

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
  ValidateIf
} from 'class-validator'
import { Type } from 'class-transformer'
import { Profil } from '../../../domain/profil'
import { Deploiement } from '../../../domain/deploiement'
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
      'Identifiant de la fonctionnalité, choisi à la création. Rejouer la route avec le même id ne change rien.',
    example: 'PLAN_D_ACTION'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string
}

export class CreerPopulationPayload {
  @ApiProperty({
    description: 'Identifiant de la population, choisi à la création',
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string

  @ApiPropertyOptional({ example: 'Beta testeurs 1J1S' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class ConseillersPopulationPayload {
  @ApiProperty({
    description: "Identifiant d'une population existante",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['a.dupont@francetravail.fr', 'b.martin@milo.fr']
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emailConseillers: string[]
}

export class SupprimerConseillersPopulationPayload {
  @ApiProperty({
    description: "Identifiant d'une population existante",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'Requis et non vide, sauf si supprimerTous vaut true'
  })
  @ValidateIf(payload => !payload.supprimerTous)
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emailConseillers?: string[]

  @ApiPropertyOptional({
    description: 'Retire tous les conseillers de la population'
  })
  @IsOptional()
  @IsBoolean()
  @IsIn([false, true])
  supprimerTous?: boolean
}

export class ProfilPopulationPayload {
  @ApiProperty({
    description: "Identifiant d'une population existante",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiProperty({ enum: Profil.Structure, example: 'FRANCE_TRAVAIL' })
  @IsEnum(Profil.Structure)
  structure: Profil.Structure

  @ApiPropertyOptional({
    enum: Profil.Dispositif,
    description: 'Absent = tous les dispositifs de la structure',
    example: 'CEJ'
  })
  @IsOptional()
  @IsEnum(Profil.Dispositif)
  dispositif?: Profil.Dispositif
}

export class StructureMiloPopulationPayload {
  @ApiProperty({
    description: "Identifiant d'une population existante",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiProperty({
    description: 'Id de la structure MiLo, voir la table structure_milo',
    example: '80620S00'
  })
  @IsString()
  @IsNotEmpty()
  idStructureMilo: string
}

export class AgenceFTPopulationPayload {
  @ApiProperty({
    description: "Identifiant d'une population existante",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiProperty({
    description: 'Id de l’agence France Travail, voir la table agence',
    example: '75056'
  })
  @IsString()
  @IsNotEmpty()
  idAgence: string
}

export class CreerDeploiementPayload {
  @ApiProperty({
    enum: Deploiement.Nature,
    description:
      'FONCTIONNALITE active un drapeau pour les jeunes, MIGRATION bloque la connexion des jeunes et conseillers',
    example: 'FONCTIONNALITE'
  })
  @IsEnum(Deploiement.Nature)
  nature: Deploiement.Nature

  @ApiProperty({
    description:
      "Identifiant d'une population existante, voir GET /support/populations",
    example: 'PILOTE_1J1S'
  })
  @IsString()
  @IsNotEmpty()
  idPopulation: string

  @ApiPropertyOptional({
    description:
      'Requis pour la nature FONCTIONNALITE, interdit pour MIGRATION, voir GET /support/fonctionnalites',
    example: 'PLAN_D_ACTION'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idFonctionnalite?: string

  @ApiProperty({
    description:
      'Date ISO 8601 à partir de laquelle le déploiement est actif, comparée en UTC',
    example: '2026-10-13T00:00:00.000Z'
  })
  @IsISO8601()
  dateActivation: string
}

export class ModifierDateDeploiementPayload {
  @ApiProperty({
    description:
      'Nouvelle date ISO 8601 à partir de laquelle le déploiement est actif, comparée en UTC',
    example: '2026-11-02T00:00:00.000Z'
  })
  @IsISO8601()
  dateActivation: string
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

  @ApiPropertyOptional({
    description:
      "Id d'une population pour ne cibler que ses bénéficiaires, absent = tous les bénéficiaires"
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idPopulation?: string

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

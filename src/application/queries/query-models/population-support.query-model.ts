import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Communication } from '../../../domain/communication'
import { Deploiement } from '../../../domain/deploiement'
import { Profil } from '../../../domain/profil'

export class ProfilPopulationQueryModel {
  @ApiProperty({ enum: Profil.Structure })
  structure: Profil.Structure

  @ApiPropertyOptional({ enum: Profil.Dispositif })
  dispositif?: Profil.Dispositif
}

export class DeploiementQueryModel {
  @ApiProperty()
  id: number

  @ApiProperty({ enum: Deploiement.Nature })
  nature: Deploiement.Nature

  @ApiPropertyOptional()
  idFonctionnalite?: string

  @ApiProperty({ description: 'Date d’activation, en UTC' })
  dateActivation: string
}

export class CommunicationSupportQueryModel {
  @ApiProperty()
  id: number

  @ApiProperty({ enum: Communication.Destinataire })
  destinataire: Communication.Destinataire

  @ApiProperty({ enum: Communication.Type })
  type: Communication.Type

  @ApiProperty({ description: 'Début de visibilité, en UTC' })
  dateDebut: string

  @ApiPropertyOptional({
    description:
      'Fin de visibilité (exclue), en UTC. Absente = IN_APP visible indéfiniment, ou communication NOTIFICATION (toujours sans dateFin).'
  })
  dateFin?: string

  @ApiProperty()
  titre: string

  @ApiProperty()
  contenu: string

  @ApiPropertyOptional()
  ctaLabel?: string

  @ApiPropertyOptional()
  ctaUrlAndroid?: string

  @ApiPropertyOptional()
  ctaUrlIos?: string
}

export class StructureMiloPopulationQueryModel {
  @ApiProperty()
  idStructureMilo: string

  @ApiPropertyOptional({
    enum: Profil.Dispositif,
    isArray: true,
    description: 'Absent = toute la structure'
  })
  dispositifs?: Profil.Dispositif[]
}

export class AgenceFTPopulationQueryModel {
  @ApiProperty()
  idAgence: string

  @ApiPropertyOptional({
    enum: Profil.Dispositif,
    isArray: true,
    description: 'Absent = toute l’agence'
  })
  dispositifs?: Profil.Dispositif[]
}

export class PopulationSupportQueryModel {
  @ApiProperty()
  id: string

  @ApiPropertyOptional()
  description?: string

  @ApiProperty({ type: String, isArray: true })
  conseillers: string[]

  @ApiProperty({ type: ProfilPopulationQueryModel, isArray: true })
  profils: ProfilPopulationQueryModel[]

  @ApiProperty({
    type: StructureMiloPopulationQueryModel,
    isArray: true,
    description:
      'Structures MiLo citées : leurs conseillers et leurs jeunes, restreints aux dispositifs quand ils sont renseignés'
  })
  structuresMilo: StructureMiloPopulationQueryModel[]

  @ApiProperty({
    type: AgenceFTPopulationQueryModel,
    isArray: true,
    description:
      'Agences France Travail citées : leurs conseillers et les jeunes de référence de ces conseillers, restreints aux dispositifs quand ils sont renseignés'
  })
  agencesFT: AgenceFTPopulationQueryModel[]

  @ApiProperty({ type: DeploiementQueryModel, isArray: true })
  deploiements: DeploiementQueryModel[]

  @ApiProperty({ type: CommunicationSupportQueryModel, isArray: true })
  communications: CommunicationSupportQueryModel[]
}

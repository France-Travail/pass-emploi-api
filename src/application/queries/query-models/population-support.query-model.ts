import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
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
    type: String,
    isArray: true,
    description:
      'Ids des structures MiLo citées : leurs conseillers et leurs jeunes'
  })
  structuresMilo: string[]

  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Ids des agences France Travail citées : leurs conseillers et les jeunes de référence de ces conseillers'
  })
  agencesFT: string[]

  @ApiProperty({ type: DeploiementQueryModel, isArray: true })
  deploiements: DeploiementQueryModel[]
}

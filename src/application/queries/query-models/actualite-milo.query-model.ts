import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ActualiteMiloQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  titre: string

  @ApiProperty()
  contenu: string

  @ApiPropertyOptional()
  titreLien?: string

  @ApiPropertyOptional()
  lien?: string

  @ApiProperty()
  dateCreation: string

  @ApiPropertyOptional()
  dateModification?: string
}

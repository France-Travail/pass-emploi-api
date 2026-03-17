import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ActualiteMiloBaseQueryModel {
  @ApiProperty()
  titre: string

  @ApiProperty()
  contenu: string

  @ApiPropertyOptional()
  titreLien?: string

  @ApiPropertyOptional()
  lien?: string

  @ApiProperty()
  prenomNomConseiller: string

  @ApiProperty()
  dateCreation: string

  @ApiPropertyOptional()
  dateSuppression?: string
}

export class ActualiteMiloJeuneQueryModel extends ActualiteMiloBaseQueryModel {}

export class ActualiteMiloConseillerQueryModel extends ActualiteMiloBaseQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  proprietaire: boolean
}

export class ActualitesMiloJeuneQueryModel {
  @ApiProperty({ type: ActualiteMiloJeuneQueryModel, isArray: true })
  actualites: ActualiteMiloJeuneQueryModel[]
}

export class ActualitesMiloConseillerQueryModel {
  @ApiProperty({ type: ActualiteMiloConseillerQueryModel, isArray: true })
  actualites: ActualiteMiloConseillerQueryModel[]
}

export class ActualiteMiloSuppresionCommandResult {
  dateSuppression: string
}

export class ActualiteMiloCreateCommandResult {
  id: string
}

import { ApiProperty } from '@nestjs/swagger'
import { Offre } from '../../../domain/offre/offre'

export class OffreImmersionQueryModelV3 {
  @ApiProperty()
  siret: string
  @ApiProperty()
  appellationCode: string
  @ApiProperty()
  locationId: string
  @ApiProperty()
  metier: string
  @ApiProperty()
  nomEtablissement: string
  @ApiProperty()
  secteurActivite: string
  @ApiProperty()
  ville: string
  @ApiProperty({
    required: false,
    enum: Offre.Immersion.ImmersionAccessibleTravailleurHandicape
  })
  accessibleTravailleurHandicape?: Offre.Immersion.ImmersionAccessibleTravailleurHandicape
}

export class FavoriOffreImmersionQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty({
    format: 'date-time'
  })
  dateCreation: string

  @ApiProperty({
    format: 'date-time',
    required: false
  })
  dateCandidature?: string
}

export class ResultatRechercheOffresImmersionQueryModelV3 {
  @ApiProperty({ type: OffreImmersionQueryModelV3, isArray: true })
  offres: OffreImmersionQueryModelV3[]
  @ApiProperty()
  nombrePages: number
  @ApiProperty()
  nombreTotal: number
}

export class DetailOffreImmersionQueryModelV3 extends OffreImmersionQueryModelV3 {
  @ApiProperty()
  adresse: string
  @ApiProperty({ enum: Offre.Immersion.MethodeDeContact })
  contact: Offre.Immersion.MethodeDeContact
  @ApiProperty({ required: false })
  informationsComplementaires?: string
  @ApiProperty({ required: false })
  siteWeb?: string
  @ApiProperty({
    enum: Offre.Immersion.ImmersionModeDistanciel
  })
  modeDistanciel: Offre.Immersion.ImmersionModeDistanciel
}

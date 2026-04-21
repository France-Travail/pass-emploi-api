import { ApiProperty } from '@nestjs/swagger'
import { Offre } from '../../../domain/offre/offre'

export class ContactImmersionQueryModel {
  @ApiProperty()
  modeDeContact: Offre.Immersion.MethodeDeContact
}
export class ModeDistancielImmersionQueryModel {
  @ApiProperty()
  modeDistanciel: Offre.Immersion.ImmersionModeDistanciel
}
export class AccessibleTravailleurHandicapeImmersionQueryModel {
  @ApiProperty()
  accessibleTravailleurHandicape: Offre.Immersion.ImmersionAccessibleTravailleurHandicape
}

export class LocalisationQueryModel {
  @ApiProperty()
  latitude: number
  @ApiProperty()
  longitude: number
}

export class OffreImmersionQueryModel {
  @ApiProperty()
  id: string
  @ApiProperty()
  metier: string
  @ApiProperty()
  nomEtablissement: string
  @ApiProperty()
  secteurActivite: string
  @ApiProperty()
  ville: string
  @ApiProperty()
  estVolontaire: boolean
}

export class OffreImmersionQueryModelV3 {
  @ApiProperty()
  siret: string
  @ApiProperty()
  metier: string
  @ApiProperty()
  nomEtablissement: string
  @ApiProperty()
  secteurActivite: string
  @ApiProperty()
  ville: string
  @ApiProperty()
  locationId: string
  @ApiProperty()
  appellationCode: string
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

export class DetailOffreImmersionQueryModel extends OffreImmersionQueryModel {
  @ApiProperty()
  codeRome: string

  @ApiProperty()
  siret: string

  @ApiProperty()
  adresse: string

  @ApiProperty({
    required: false,
    type: LocalisationQueryModel
  })
  localisation?: LocalisationQueryModel

  @ApiProperty({
    required: false
  })
  contact?: ContactImmersionQueryModel
}

export class DetailOffreImmersionQueryModelV3 extends OffreImmersionQueryModelV3 {
  @ApiProperty()
  adresse: string
  @ApiProperty({ enum: Offre.Immersion.MethodeDeContact })
  contact: ContactImmersionQueryModel
  @ApiProperty({ required: false })
  informationsComplementaires?: string
  @ApiProperty({ required: false })
  siteWeb?: string
  @ApiProperty({
    required: false,
    enum: Offre.Immersion.ImmersionModeDistanciel
  })
  modeDistanciel?: ModeDistancielImmersionQueryModel
  @ApiProperty({
    required: false,
    enum: Offre.Immersion.ImmersionAccessibleTravailleurHandicape
  })
  accessibleTravailleurHandicape?: AccessibleTravailleurHandicapeImmersionQueryModel
}

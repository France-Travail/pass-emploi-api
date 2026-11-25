import { ApiProperty } from '@nestjs/swagger'

export enum TypeStructureAccompagnement {
  MILO = 'MILO',
  FRANCE_TRAVAIL = 'FRANCE_TRAVAIL'
}

export class AdresseStructureAccompagnementQueryModel {
  @ApiProperty({ type: String, nullable: true })
  ligne: string | null

  @ApiProperty({ type: String, nullable: true })
  codePostal: string | null

  @ApiProperty({ type: String, nullable: true })
  ville: string | null
}

export class StructureAccompagnementQueryModel {
  @ApiProperty()
  nom: string

  @ApiProperty({ type: AdresseStructureAccompagnementQueryModel })
  adresse: AdresseStructureAccompagnementQueryModel

  @ApiProperty({ type: String, nullable: true })
  telephone: string | null

  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['Lun–mer · 8h30 – 16h30', 'Jeu · 8h30 – 12h30']
  })
  horaires: string[] | null

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      'Lundi à jeudi ouvert de 9h à 13h15 en accès libre et de 13h15 à 17h sur rendez-vous, et vendredi ouvert de 9h à 12h.'
  })
  horairesAlt: string | null
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class MessageInformatifQueryModel {
  @ApiProperty({
    description: 'Identique pour tous les utilisateurs d’une même population'
  })
  id: number

  @ApiProperty()
  titre: string

  @ApiProperty({
    description: 'Texte brut, les sauts de ligne (\\n) sont à respecter'
  })
  contenu: string
}

export class CommunicationsConseillerQueryModel {
  @ApiPropertyOptional({
    type: MessageInformatifQueryModel,
    description: 'Absent quand aucune communication n’est visible'
  })
  messageInformatif?: MessageInformatifQueryModel
}

export class CtaQueryModel {
  @ApiProperty({ example: 'Télécharger l’application' })
  label: string

  @ApiProperty({ description: 'Lien vers le Play Store' })
  urlAndroid: string

  @ApiProperty({ description: 'Lien vers l’App Store' })
  urlIos: string
}

export class MessageInformatifJeuneQueryModel extends MessageInformatifQueryModel {
  @ApiPropertyOptional({
    type: CtaQueryModel,
    description: 'Absent quand la communication n’a pas de bouton d’action'
  })
  cta?: CtaQueryModel
}

export class CommunicationsJeuneQueryModel {
  @ApiPropertyOptional({
    type: MessageInformatifJeuneQueryModel,
    description: 'Absent quand aucune communication n’est visible'
  })
  messageInformatif?: MessageInformatifJeuneQueryModel
}

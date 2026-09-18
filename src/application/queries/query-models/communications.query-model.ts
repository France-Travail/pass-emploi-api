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

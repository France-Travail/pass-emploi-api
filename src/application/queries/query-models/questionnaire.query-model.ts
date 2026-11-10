import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'

export class CommuneQuestionnaireQueryModel {
  @ApiProperty()
  codeInsee: string

  @ApiProperty()
  nom: string
}

export class QuestionnaireQueryModel {
  @ApiPropertyOptional({
    enum: Questionnaire.Situation,
    description: 'Absente quand le jeune a passé la question'
  })
  situation?: Questionnaire.Situation

  @ApiPropertyOptional()
  precisionAutre?: string

  @ApiProperty({ enum: Questionnaire.Besoin, isArray: true })
  goals: Questionnaire.Besoin[]

  @ApiProperty({ enum: Questionnaire.Contrainte, isArray: true })
  obstacles: Questionnaire.Contrainte[]

  @ApiPropertyOptional({ format: 'date' })
  dateNaissance?: string

  @ApiPropertyOptional({ type: CommuneQuestionnaireQueryModel })
  habitation?: CommuneQuestionnaireQueryModel

  @ApiPropertyOptional({ type: CommuneQuestionnaireQueryModel })
  villeRecherche?: CommuneQuestionnaireQueryModel

  @ApiPropertyOptional()
  domaine?: string

  @ApiProperty()
  domaineInconnu: boolean

  @ApiPropertyOptional()
  rayonKm?: number
}

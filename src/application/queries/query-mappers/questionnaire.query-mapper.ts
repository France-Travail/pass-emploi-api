import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { QuestionnaireQueryModel } from '../query-models/questionnaire.query-model'

export function toQuestionnaireQueryModel(
  questionnaire: Questionnaire
): QuestionnaireQueryModel {
  const dateNaissance = questionnaire.dateNaissance?.toISODate()

  return {
    situation: questionnaire.situation,
    ...(questionnaire.precisionSituation
      ? { precisionAutre: questionnaire.precisionSituation }
      : {}),
    goals: questionnaire.besoins,
    obstacles: questionnaire.contraintes,
    ...(dateNaissance ? { dateNaissance } : {}),
    ...(questionnaire.communeResidence
      ? { habitation: questionnaire.communeResidence }
      : {}),
    ...(questionnaire.communeRecherche
      ? { villeRecherche: questionnaire.communeRecherche }
      : {}),
    ...(questionnaire.domaineProfessionnelVise
      ? { domaine: questionnaire.domaineProfessionnelVise }
      : {}),
    ...(questionnaire.rayonKm !== undefined
      ? { rayonKm: questionnaire.rayonKm }
      : {})
  }
}

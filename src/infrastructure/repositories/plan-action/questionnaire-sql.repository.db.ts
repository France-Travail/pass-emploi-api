import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Profil } from '../../../domain/profil'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { QuestionnaireSqlModel } from '../../sequelize/models/questionnaire.sql-model'

@Injectable()
export class QuestionnaireSqlRepository implements Questionnaire.Repository {
  async save(questionnaire: Questionnaire.Enregistre): Promise<void> {
    await QuestionnaireSqlModel.upsert({
      idJeune: questionnaire.idJeune,
      dateCreation: questionnaire.dateCreation.toJSDate(),
      structure: questionnaire.structure,
      situation: questionnaire.situation,
      besoins: questionnaire.besoins,
      contraintes: questionnaire.contraintes,
      dateNaissance: questionnaire.dateNaissance?.toISODate() ?? null,
      codeInseeCommuneResidence:
        questionnaire.communeResidence?.codeInsee ?? null,
      nomCommuneResidence: questionnaire.communeResidence?.nom ?? null,
      codeInseeCommuneRecherche:
        questionnaire.communeRecherche?.codeInsee ?? null,
      nomCommuneRecherche: questionnaire.communeRecherche?.nom ?? null,
      domaineProfessionnelVise: questionnaire.domaineProfessionnelVise ?? null,
      rayonKm: questionnaire.rayonKm ?? null
    })
  }

  async get(idJeune: string): Promise<Questionnaire.Enregistre | undefined> {
    const questionnaireSql = await QuestionnaireSqlModel.findByPk(idJeune)
    if (!questionnaireSql) return undefined

    return {
      idJeune: questionnaireSql.idJeune,
      dateCreation: DateTime.fromJSDate(questionnaireSql.dateCreation),
      structure: questionnaireSql.structure as Profil.Structure,
      situation: questionnaireSql.situation as Questionnaire.Situation,
      besoins: questionnaireSql.besoins as Questionnaire.Besoin[],
      contraintes: questionnaireSql.contraintes as Questionnaire.Contrainte[],
      ...(questionnaireSql.dateNaissance
        ? { dateNaissance: DateTime.fromISO(questionnaireSql.dateNaissance) }
        : {}),
      ...(questionnaireSql.codeInseeCommuneResidence &&
      questionnaireSql.nomCommuneResidence
        ? {
            communeResidence: {
              codeInsee: questionnaireSql.codeInseeCommuneResidence,
              nom: questionnaireSql.nomCommuneResidence
            }
          }
        : {}),
      ...(questionnaireSql.codeInseeCommuneRecherche &&
      questionnaireSql.nomCommuneRecherche
        ? {
            communeRecherche: {
              codeInsee: questionnaireSql.codeInseeCommuneRecherche,
              nom: questionnaireSql.nomCommuneRecherche
            }
          }
        : {}),
      ...(questionnaireSql.domaineProfessionnelVise
        ? {
            domaineProfessionnelVise: questionnaireSql.domaineProfessionnelVise
          }
        : {}),
      ...(questionnaireSql.rayonKm !== null
        ? { rayonKm: questionnaireSql.rayonKm }
        : {})
    }
  }
}

import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { Profil } from '../../../domain/profil'
import { PlanActionObjectifSqlModel } from '../../sequelize/models/plan-action-objectif.sql-model'
import { PlanActionTacheSqlModel } from '../../sequelize/models/plan-action-tache.sql-model'
import {
  PlanActionDto,
  PlanActionSqlModel
} from '../../sequelize/models/plan-action.sql-model'

const COLONNES_QUESTIONNAIRE = [
  'structure',
  'situation',
  'precisionSituation',
  'besoins',
  'contraintes',
  'dateNaissance',
  'codeInseeCommuneResidence',
  'nomCommuneResidence',
  'codeInseeCommuneRecherche',
  'nomCommuneRecherche',
  'domaineProfessionnelVise',
  'rayonKm'
] as const

@Injectable()
export class PlanActionSqlRepository implements PlanAction.Repository {
  // Sans transaction propre : l'appelant englobe dans TransactionService pour
  // que le plan s'écrive avec ses autres écritures, ou pas du tout
  async save(plan: PlanAction): Promise<void> {
    await PlanActionSqlModel.create({
      id: plan.id,
      idJeune: plan.idJeune,
      dateCreation: plan.dateCreation.toJSDate(),
      dateMaj: plan.dateCreation.toJSDate(),
      ...toQuestionnaireSql(plan.questionnaire)
    })

    await PlanActionObjectifSqlModel.bulkCreate(
      plan.objectifs.map(objectif => ({
        id: objectif.id,
        idPlanAction: plan.id,
        titre: objectif.titre,
        theme: objectif.theme
      }))
    )

    await PlanActionTacheSqlModel.bulkCreate(
      plan.objectifs.flatMap(objectif =>
        objectif.taches.map(tache => ({
          id: tache.id,
          idObjectif: objectif.id,
          idSolution: tache.idSolution,
          terminee: tache.terminee,
          dateCreation: tache.dateCreation.toJSDate(),
          dateTerminee: tache.dateTerminee?.toJSDate() ?? null,
          dateSuppression: tache.dateSuppression?.toJSDate() ?? null
        }))
      )
    )
  }

  async getDernierPlan(idJeune: string): Promise<PlanAction | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      // Objectifs et tâches sont rendus sans ordre garanti : c'est
      // PlanAction.ordonner qui les présente
      order: [['dateCreation', 'DESC']],
      include: [
        {
          model: PlanActionObjectifSqlModel,
          include: [PlanActionTacheSqlModel]
        }
      ]
    })
    if (!planSql) return undefined

    const questionnaire = toQuestionnaire(planSql)
    return {
      id: planSql.id,
      idJeune: planSql.idJeune,
      dateCreation: DateTime.fromJSDate(planSql.dateCreation),
      objectifs: planSql.objectifs.map(objectifSql => ({
        id: objectifSql.id,
        titre: objectifSql.titre,
        theme: objectifSql.theme as
          Questionnaire.Besoin | Questionnaire.Contrainte,
        taches: objectifSql.taches.map(toTache)
      })),
      ...(questionnaire ? { questionnaire } : {})
    }
  }

  async getQuestionnaireDuDernierPlan(
    idJeune: string
  ): Promise<Questionnaire | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      order: [['dateCreation', 'DESC']],
      attributes: [...COLONNES_QUESTIONNAIRE]
    })
    if (!planSql) return undefined

    return toQuestionnaire(planSql)
  }

  async existePourJeune(idJeune: string): Promise<boolean> {
    const plan = await PlanActionSqlModel.findOne({
      where: { idJeune },
      attributes: ['id']
    })
    return plan !== null
  }

  async getTache(
    idJeune: string,
    idTache: string
  ): Promise<PlanAction.Tache | undefined> {
    const dernierPlanSql = await PlanActionSqlModel.findOne({
      attributes: ['id'],
      where: { idJeune },
      order: [['dateCreation', 'DESC']]
    })
    if (!dernierPlanSql) return undefined

    const tacheSql = await PlanActionTacheSqlModel.findOne({
      where: { id: idTache, dateSuppression: null },
      include: [
        {
          model: PlanActionObjectifSqlModel,
          required: true,
          where: { idPlanAction: dernierPlanSql.id }
        }
      ]
    })
    if (!tacheSql) return undefined

    return toTache(tacheSql)
  }

  async saveTache(tache: PlanAction.Tache): Promise<void> {
    await PlanActionTacheSqlModel.update(
      {
        terminee: tache.terminee,
        dateTerminee: tache.dateTerminee?.toJSDate() ?? null
      },
      { where: { id: tache.id } }
    )
  }

  async supprimerTache(
    idTache: string,
    dateSuppression: DateTime
  ): Promise<void> {
    await PlanActionTacheSqlModel.update(
      { dateSuppression: dateSuppression.toJSDate() },
      { where: { id: idTache } }
    )
  }
}

function toTache(tacheSql: PlanActionTacheSqlModel): PlanAction.Tache {
  return {
    id: tacheSql.id,
    idSolution: tacheSql.idSolution,
    terminee: tacheSql.terminee,
    dateCreation: DateTime.fromJSDate(tacheSql.dateCreation),
    ...(tacheSql.dateTerminee
      ? { dateTerminee: DateTime.fromJSDate(tacheSql.dateTerminee) }
      : {}),
    ...(tacheSql.dateSuppression
      ? { dateSuppression: DateTime.fromJSDate(tacheSql.dateSuppression) }
      : {})
  }
}

function toQuestionnaireSql(
  questionnaire: Questionnaire | undefined
): Partial<PlanActionDto> {
  if (!questionnaire) return {}

  return {
    structure: questionnaire.structure,
    situation: questionnaire.situation,
    precisionSituation: questionnaire.precisionSituation ?? null,
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
  }
}

function toQuestionnaire(
  planSql: PlanActionSqlModel
): Questionnaire | undefined {
  if (
    !planSql.structure ||
    !planSql.situation ||
    !planSql.besoins ||
    !planSql.contraintes
  ) {
    return undefined
  }

  return {
    structure: planSql.structure as Profil.Structure,
    situation: planSql.situation as Questionnaire.Situation,
    ...(planSql.precisionSituation
      ? { precisionSituation: planSql.precisionSituation }
      : {}),
    besoins: planSql.besoins as Questionnaire.Besoin[],
    contraintes: planSql.contraintes as Questionnaire.Contrainte[],
    ...(planSql.dateNaissance
      ? { dateNaissance: DateTime.fromISO(planSql.dateNaissance) }
      : {}),
    ...(planSql.codeInseeCommuneResidence && planSql.nomCommuneResidence
      ? {
          communeResidence: {
            codeInsee: planSql.codeInseeCommuneResidence,
            nom: planSql.nomCommuneResidence
          }
        }
      : {}),
    ...(planSql.codeInseeCommuneRecherche && planSql.nomCommuneRecherche
      ? {
          communeRecherche: {
            codeInsee: planSql.codeInseeCommuneRecherche,
            nom: planSql.nomCommuneRecherche
          }
        }
      : {}),
    ...(planSql.domaineProfessionnelVise
      ? { domaineProfessionnelVise: planSql.domaineProfessionnelVise }
      : {}),
    ...(planSql.rayonKm !== null ? { rayonKm: planSql.rayonKm } : {})
  }
}

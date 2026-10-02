import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Sequelize } from 'sequelize'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { PlanActionObjectifSqlModel } from '../../sequelize/models/plan-action-objectif.sql-model'
import { PlanActionTacheSqlModel } from '../../sequelize/models/plan-action-tache.sql-model'
import { PlanActionSqlModel } from '../../sequelize/models/plan-action.sql-model'
import { SequelizeInjectionToken } from '../../sequelize/providers'

@Injectable()
export class PlanActionSqlRepository implements PlanAction.Repository {
  constructor(
    @Inject(SequelizeInjectionToken)
    private readonly sequelize: Sequelize
  ) {}

  async save(plan: PlanAction): Promise<void> {
    await this.sequelize.transaction(async transaction => {
      await PlanActionSqlModel.create(
        {
          id: plan.id,
          idJeune: plan.idJeune,
          dateCreation: plan.dateCreation.toJSDate(),
          dateMaj: plan.dateCreation.toJSDate()
        },
        { transaction }
      )

      await PlanActionObjectifSqlModel.bulkCreate(
        plan.objectifs.map((objectif, ordre) => ({
          id: objectif.id,
          idPlanAction: plan.id,
          titre: objectif.titre,
          theme: objectif.theme,
          ordre
        })),
        { transaction }
      )

      await PlanActionTacheSqlModel.bulkCreate(
        plan.objectifs.flatMap(objectif =>
          objectif.taches.map((tache, ordre) => ({
            id: tache.id,
            idObjectif: objectif.id,
            idSolution: tache.idSolution,
            terminee: tache.terminee,
            dateCreation: tache.dateCreation.toJSDate(),
            dateTerminee: tache.dateTerminee?.toJSDate() ?? null,
            dateSuppression: tache.dateSuppression?.toJSDate() ?? null,
            ordre
          }))
        ),
        { transaction }
      )
    })
  }

  async getDernierPlan(idJeune: string): Promise<PlanAction | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      // L'ordre du plan est celui dans lequel il a été construit : objectifs dans l'ordre du questionnaire, tâches dans l'ordre du référentiel.
      // Les plans antérieurs à la colonne ordre retombent sur l'ancien tri
      order: [
        ['dateCreation', 'DESC'],
        ['objectifs', 'ordre', 'ASC'],
        ['objectifs', 'id', 'ASC'],
        ['objectifs', 'taches', 'ordre', 'ASC'],
        ['objectifs', 'taches', 'dateCreation', 'ASC']
      ],
      include: [
        {
          model: PlanActionObjectifSqlModel,
          include: [PlanActionTacheSqlModel]
        }
      ]
    })
    if (!planSql) return undefined

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
      }))
    }
  }

  async getTache(
    idJeune: string,
    idTache: string
  ): Promise<PlanAction.Tache | undefined> {
    const tacheSql = await PlanActionTacheSqlModel.findOne({
      where: { id: idTache, dateSuppression: null },
      include: [
        {
          model: PlanActionObjectifSqlModel,
          required: true,
          include: [
            {
              model: PlanActionSqlModel,
              required: true,
              where: { idJeune }
            }
          ]
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

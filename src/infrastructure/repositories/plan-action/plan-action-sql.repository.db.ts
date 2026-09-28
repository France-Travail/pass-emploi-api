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
        plan.objectifs.map(objectif => ({
          id: objectif.id,
          idPlanAction: plan.id,
          titre: objectif.titre,
          theme: objectif.theme
        })),
        { transaction }
      )

      await PlanActionTacheSqlModel.bulkCreate(
        plan.objectifs.flatMap(objectif =>
          objectif.taches.map(tache => ({
            id: tache.id,
            idObjectif: objectif.id,
            idSolution: tache.idSolution,
            terminee: tache.terminee,
            dateCreation: tache.dateCreation.toJSDate(),
            dateTerminee: tache.dateTerminee?.toJSDate() ?? null
          }))
        ),
        { transaction }
      )
    })
  }

  async getDernierPlan(idJeune: string): Promise<PlanAction | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      order: [
        ['dateCreation', 'DESC'],
        ['objectifs', 'id', 'ASC'],
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
      where: { id: idTache },
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

  async supprimerTache(idTache: string): Promise<void> {
    await PlanActionTacheSqlModel.destroy({ where: { id: idTache } })
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
      : {})
  }
}

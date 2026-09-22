import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Sequelize } from 'sequelize'
import { PlanAction } from '../../../domain/plan-action/plan-action'
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
      order: [['dateCreation', 'DESC']],
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
        theme: objectifSql.theme,
        taches: objectifSql.taches.map(toTache)
      }))
    }
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

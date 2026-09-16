import { Inject, Injectable } from '@nestjs/common'
import { Sequelize } from 'sequelize'
import {
  ActionPlanQueryModel,
  DestinationActionPlan,
  PlanActionConnecteQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../../../application/queries/query-models/plan-action.query-model'
import { DateService } from '../../../utils/date-service'
import { IdService } from '../../../utils/id-service'
import { PlanActionObjectifSqlModel } from '../../sequelize/models/plan-action-objectif.sql-model'
import { PlanActionTacheSqlModel } from '../../sequelize/models/plan-action-tache.sql-model'
import { PlanActionSqlModel } from '../../sequelize/models/plan-action.sql-model'
import {
  ReferentielPlanActionTacheDto,
  ReferentielPlanActionTacheSqlModel
} from '../../sequelize/models/referentiel-plan-action-tache.sql-model'
import { SequelizeInjectionToken } from '../../sequelize/providers'
import { AsSql } from '../../sequelize/types'

@Injectable()
export class PlanActionSqlRepository {
  constructor(
    private idService: IdService,
    private dateService: DateService,
    @Inject(SequelizeInjectionToken)
    private readonly sequelize: Sequelize
  ) {}

  async save(idJeune: string, plan: PlanActionQueryModel): Promise<void> {
    const maintenant = this.dateService.now().toJSDate()

    await this.sequelize.transaction(async transaction => {
      for (const objectif of plan.objectives) {
        for (const action of objectif.actions) {
          await ReferentielPlanActionTacheSqlModel.upsert(
            referentielFromAction(action),
            { transaction }
          )
        }
      }

      await PlanActionSqlModel.create(
        {
          id: plan.id,
          idJeune,
          dateCreation: maintenant,
          dateMaj: maintenant
        },
        { transaction }
      )

      await PlanActionObjectifSqlModel.bulkCreate(
        plan.objectives.map(objectif => ({
          id: objectif.id,
          idPlanAction: plan.id,
          titre: objectif.titre,
          theme: objectif.theme
        })),
        { transaction }
      )

      await PlanActionTacheSqlModel.bulkCreate(
        plan.objectives.flatMap(objectif =>
          objectif.actions.map(action => ({
            id: this.idService.uuid(),
            idObjectif: objectif.id,
            idTacheReferentiel: action.id,
            terminee: false,
            dateCreation: maintenant,
            dateTerminee: null
          }))
        ),
        { transaction }
      )
    })
  }

  async getDernierPlan(
    idJeune: string
  ): Promise<PlanActionConnecteQueryModel | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      order: [['dateCreation', 'DESC']],
      include: [
        {
          model: PlanActionObjectifSqlModel,
          include: [
            {
              model: PlanActionTacheSqlModel,
              include: [ReferentielPlanActionTacheSqlModel]
            }
          ]
        }
      ]
    })
    if (!planSql) return undefined

    return {
      id: planSql.id,
      objectives: planSql.objectifs.map(objectifSql => ({
        id: objectifSql.id,
        titre: objectifSql.titre,
        theme: objectifSql.theme,
        actions: objectifSql.taches.map(tacheSql =>
          actionFromReferentiel(tacheSql.referentiel)
        )
      }))
    }
  }
}

function referentielFromAction(
  action: ActionPlanQueryModel
): AsSql<ReferentielPlanActionTacheDto> {
  return {
    id: action.id,
    label: action.libelle,
    type: action.type,
    deeplink: action.destination ?? null,
    url: action.url ?? null,
    nomService: action.nomService ?? null,
    nomDescription: action.descriptionService ?? null
  }
}

function actionFromReferentiel(
  referentielSql: ReferentielPlanActionTacheSqlModel
): ActionPlanQueryModel {
  return {
    id: referentielSql.id,
    libelle: referentielSql.label,
    type: referentielSql.type as TypeActionPlan,
    ...(referentielSql.deeplink
      ? { destination: referentielSql.deeplink as DestinationActionPlan }
      : {}),
    ...(referentielSql.url ? { url: referentielSql.url } : {}),
    ...(referentielSql.nomService
      ? { nomService: referentielSql.nomService }
      : {}),
    ...(referentielSql.nomDescription
      ? { descriptionService: referentielSql.nomDescription }
      : {})
  }
}

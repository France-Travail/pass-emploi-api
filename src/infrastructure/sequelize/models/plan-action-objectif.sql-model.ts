import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { PlanActionSqlModel } from './plan-action.sql-model'
import { PlanActionTacheSqlModel } from './plan-action-tache.sql-model'

export class PlanActionObjectifDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @ForeignKey(() => PlanActionSqlModel)
  @Column({ field: 'id_plan_action', type: DataType.STRING })
  idPlanAction: string

  @Column({ field: 'titre', type: DataType.STRING })
  titre: string

  @Column({ field: 'theme', type: DataType.STRING })
  theme: string
}

@Table({ timestamps: false, tableName: 'plan_action_objectif' })
export class PlanActionObjectifSqlModel extends PlanActionObjectifDto {
  @BelongsTo(() => PlanActionSqlModel)
  planAction: PlanActionSqlModel

  @HasMany(() => PlanActionTacheSqlModel)
  taches: PlanActionTacheSqlModel[]
}

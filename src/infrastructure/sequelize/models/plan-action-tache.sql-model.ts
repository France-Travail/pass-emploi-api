import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { PlanActionObjectifSqlModel } from './plan-action-objectif.sql-model'
import { ReferentielPlanActionSolutionSqlModel } from './referentiel-plan-action-solution.sql-model'

export class PlanActionTacheDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.UUID })
  id: string

  @ForeignKey(() => PlanActionObjectifSqlModel)
  @Column({ field: 'id_objectif', type: DataType.UUID })
  idObjectif: string

  @ForeignKey(() => ReferentielPlanActionSolutionSqlModel)
  @Column({ field: 'id_solution', type: DataType.STRING })
  idSolution: string

  @Column({ field: 'terminee', type: DataType.BOOLEAN })
  terminee: boolean

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'date_terminee', type: DataType.DATE })
  dateTerminee: Date | null

  @Column({ field: 'date_suppression', type: DataType.DATE })
  dateSuppression: Date | null

  @Column({ field: 'ordre', type: DataType.INTEGER })
  ordre: number | null
}

@Table({ timestamps: false, tableName: 'plan_action_tache' })
export class PlanActionTacheSqlModel extends PlanActionTacheDto {
  @BelongsTo(() => PlanActionObjectifSqlModel)
  objectif: PlanActionObjectifSqlModel

  @BelongsTo(() => ReferentielPlanActionSolutionSqlModel)
  solution: ReferentielPlanActionSolutionSqlModel
}

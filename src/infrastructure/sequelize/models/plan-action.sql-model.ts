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
import { JeuneSqlModel } from './jeune.sql-model'
import { PlanActionObjectifSqlModel } from './plan-action-objectif.sql-model'

export class PlanActionDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @ForeignKey(() => JeuneSqlModel)
  @Column({ field: 'id_jeune', type: DataType.STRING })
  idJeune: string

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'date_maj', type: DataType.DATE })
  dateMaj: Date
}

@Table({ timestamps: false, tableName: 'plan_action' })
export class PlanActionSqlModel extends PlanActionDto {
  @BelongsTo(() => JeuneSqlModel)
  jeune: JeuneSqlModel

  @HasMany(() => PlanActionObjectifSqlModel)
  objectifs: PlanActionObjectifSqlModel[]
}

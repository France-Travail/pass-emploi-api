import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

@Table({ timestamps: false, tableName: 'population' })
export class PopulationSqlModel extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'description', type: DataType.STRING })
  description: string | null
}

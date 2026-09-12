import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

@Table({ timestamps: false, tableName: 'migration' })
export class MigrationSqlModel extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string
}

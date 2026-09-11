import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

@Table({ timestamps: false, tableName: 'fonctionnalite' })
export class FonctionnaliteSqlModel extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string
}

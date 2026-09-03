import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export class RegionDto extends Model {
  @PrimaryKey
  @Column({ field: 'code', type: DataType.STRING })
  code!: string

  @Column({ field: 'libelle', type: DataType.STRING })
  libelle!: string
}

@Table({ timestamps: false, tableName: 'region' })
export class RegionSqlModel extends RegionDto {}

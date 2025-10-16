import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export enum FeatureFlipTag {
  DEMARCHES_IA = 'DEMARCHES_IA',
  MIGRATION = 'MIGRATION'
}
@Table({
  timestamps: false,
  tableName: 'feature_flip'
})
export class FeatureFlipSqlModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    field: 'id',
    type: DataType.INTEGER
  })
  id: number

  @Column({ field: 'email_conseiller', type: DataType.STRING })
  emailConseiller: string

  @Column({ field: 'feature_tag', type: DataType.STRING })
  featureTag: FeatureFlipTag
}

import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { FeatureFlip } from '../../../domain/feature-flip'

@Table({
  timestamps: false,
  tableName: 'feature_flip',
  indexes: [
    {
      name: 'feature_flip_feature_tag_email_conseiller_unique',
      type: 'UNIQUE',
      concurrently: true,
      fields: ['feature_tag', { name: 'lastName', collate: 'email_conseiller' }]
    }
  ]
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
  featureTag: FeatureFlip.Tag
}

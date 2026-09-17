import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { AgenceSqlModel } from './agence.sql-model'
import { PopulationSqlModel } from './population.sql-model'

@Table({ timestamps: false, tableName: 'population_agence_ft' })
export class PopulationAgenceFTSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => PopulationSqlModel)
  @Column({ field: 'id_population', type: DataType.STRING })
  idPopulation: string

  @PrimaryKey
  @ForeignKey(() => AgenceSqlModel)
  @Column({ field: 'id_agence', type: DataType.STRING })
  idAgence: string
}

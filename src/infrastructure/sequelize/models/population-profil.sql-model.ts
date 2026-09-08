import {
  AutoIncrement,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Profil } from '../../../domain/profil'
import { PopulationSqlModel } from './population.sql-model'

@Table({ timestamps: false, tableName: 'population_profil' })
export class PopulationProfilSqlModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ field: 'id', type: DataType.INTEGER })
  id: number

  @ForeignKey(() => PopulationSqlModel)
  @Column({ field: 'id_population', type: DataType.STRING })
  idPopulation: string

  @Column({ field: 'structure', type: DataType.STRING })
  structure: Profil.Structure

  @Column({ field: 'dispositif', type: DataType.STRING })
  dispositif: Profil.Dispositif | null
}

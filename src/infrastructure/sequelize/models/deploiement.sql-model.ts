import {
  AutoIncrement,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Deploiement } from '../../../domain/deploiement'
import { FonctionnaliteSqlModel } from './fonctionnalite.sql-model'
import { PopulationSqlModel } from './population.sql-model'

@Table({ timestamps: false, tableName: 'deploiement' })
export class DeploiementSqlModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ field: 'id', type: DataType.INTEGER })
  id: number

  @Column({ field: 'nature', type: DataType.STRING })
  nature: Deploiement.Nature

  @ForeignKey(() => PopulationSqlModel)
  @Column({ field: 'id_population', type: DataType.STRING })
  idPopulation: string

  @ForeignKey(() => FonctionnaliteSqlModel)
  @Column({ field: 'id_fonctionnalite', type: DataType.STRING })
  idFonctionnalite: string | null

  @Column({ field: 'date_activation', type: DataType.DATE })
  dateActivation: Date
}

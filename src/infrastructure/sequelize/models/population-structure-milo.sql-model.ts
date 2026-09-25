import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Profil } from '../../../domain/profil'
import { PopulationSqlModel } from './population.sql-model'
import { StructureMiloSqlModel } from './structure-milo.sql-model'

@Table({ timestamps: false, tableName: 'population_structure_milo' })
export class PopulationStructureMiloSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => PopulationSqlModel)
  @Column({ field: 'id_population', type: DataType.STRING })
  idPopulation: string

  @PrimaryKey
  @ForeignKey(() => StructureMiloSqlModel)
  @Column({ field: 'id_structure_milo', type: DataType.STRING })
  idStructureMilo: string

  // Nul = tous les dispositifs de la structure.
  @Column({ field: 'dispositifs', type: DataType.ARRAY(DataType.STRING) })
  dispositifs: Profil.Dispositif[] | null
}

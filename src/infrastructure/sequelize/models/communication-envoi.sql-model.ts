import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { CommunicationEnvoi } from '../../../domain/communication-envoi'
import { CommunicationSqlModel } from './communication.sql-model'
import { JeuneSqlModel } from './jeune.sql-model'

@Table({ timestamps: false, tableName: 'communication_envoi' })
export class CommunicationEnvoiSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => CommunicationSqlModel)
  @Column({ field: 'id_communication', type: DataType.INTEGER })
  idCommunication: number

  @PrimaryKey
  @ForeignKey(() => JeuneSqlModel)
  @Column({ field: 'id_jeune', type: DataType.STRING })
  idJeune: string

  @Column({ field: 'statut', type: DataType.STRING })
  statut: CommunicationEnvoi.Statut

  @Column({ field: 'date_traitement', type: DataType.DATE })
  dateTraitement: Date | null
}

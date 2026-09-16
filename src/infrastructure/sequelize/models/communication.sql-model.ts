import {
  AutoIncrement,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Communication } from '../../../domain/communication'
import { PopulationSqlModel } from './population.sql-model'

@Table({ timestamps: false, tableName: 'communication' })
export class CommunicationSqlModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ field: 'id', type: DataType.INTEGER })
  id: number

  @ForeignKey(() => PopulationSqlModel)
  @Column({ field: 'id_population', type: DataType.STRING })
  idPopulation: string

  @Column({ field: 'destinataire', type: DataType.STRING })
  destinataire: Communication.Destinataire

  @Column({ field: 'type', type: DataType.STRING })
  type: Communication.Type

  @Column({ field: 'date_debut', type: DataType.DATE })
  dateDebut: Date

  @Column({ field: 'date_fin', type: DataType.DATE })
  dateFin: Date

  @Column({ field: 'titre', type: DataType.STRING })
  titre: string

  @Column({ field: 'contenu', type: DataType.TEXT })
  contenu: string

  @Column({ field: 'cta_label', type: DataType.STRING })
  ctaLabel: string | null

  @Column({ field: 'cta_url_android', type: DataType.STRING })
  ctaUrlAndroid: string | null

  @Column({ field: 'cta_url_ios', type: DataType.STRING })
  ctaUrlIos: string | null
}

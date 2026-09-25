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
import { Notification } from '../../../domain/notification/notification'
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
  dateFin: Date | null

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

  @Column({ field: 'type_notification', type: DataType.STRING })
  typeNotification: Notification.Type | null

  @Column({ field: 'push', type: DataType.BOOLEAN })
  push: boolean | null

  @Column({ field: 'statut_envoi', type: DataType.STRING })
  statutEnvoi: Communication.StatutEnvoi | null

  @Column({ field: 'envoi_termine_le', type: DataType.DATE })
  envoiTermineLe: Date | null

  @Column({ field: 'echecs_consecutifs', type: DataType.INTEGER })
  echecsConsecutifs: number

  @Column({ field: 'nb_envoyees', type: DataType.INTEGER })
  nbEnvoyees: number | null

  @Column({ field: 'nb_erreurs', type: DataType.INTEGER })
  nbErreurs: number | null

  @Column({ field: 'nb_tokens_invalides', type: DataType.INTEGER })
  nbTokensInvalides: number | null
}

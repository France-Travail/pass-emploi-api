import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { FonctionnaliteSqlModel } from './fonctionnalite.sql-model'

@Table({ timestamps: false, tableName: 'fonctionnalite_conseillers' })
export class FonctionnaliteConseillerSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => FonctionnaliteSqlModel)
  @Column({ field: 'id_fonctionnalite', type: DataType.STRING })
  idFonctionnalite: string

  @PrimaryKey
  @Column({ field: 'email_conseiller', type: DataType.STRING })
  emailConseiller: string

  @Column({ field: 'date_activation', type: DataType.DATE })
  dateActivation: Date | null
}

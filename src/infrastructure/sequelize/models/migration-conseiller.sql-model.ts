import {
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { MigrationSqlModel } from './migration.sql-model'

@Table({ timestamps: false, tableName: 'migration_conseillers' })
export class MigrationConseillerSqlModel extends Model {
  @PrimaryKey
  @ForeignKey(() => MigrationSqlModel)
  @Column({ field: 'id_migration', type: DataType.STRING })
  idMigration: string

  @PrimaryKey
  @Column({ field: 'email_conseiller', type: DataType.STRING })
  emailConseiller: string

  @Column({ field: 'date_migration', type: DataType.DATE })
  dateMigration: Date | null
}

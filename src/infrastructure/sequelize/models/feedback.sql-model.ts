import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Profil } from '../../../domain/profil'

@Table({
  timestamps: false,
  tableName: 'feedback'
})
export class FeedbackSqlModel extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({
    field: 'id',
    type: DataType.INTEGER
  })
  id: number

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'id_utilisateur', type: DataType.STRING })
  idUtilisateur: string | null

  @Column({ field: 'structure', type: DataType.STRING })
  structure: Profil.Structure

  @Column({ field: 'dispositif', type: DataType.STRING })
  dispositif: Profil.Dispositif | null

  @Column({ field: 'tag', type: DataType.STRING })
  tag: string

  @Column({ field: 'note', type: DataType.INTEGER })
  note: number

  @Column({ field: 'commentaire', type: DataType.STRING })
  commentaire: string | null
}

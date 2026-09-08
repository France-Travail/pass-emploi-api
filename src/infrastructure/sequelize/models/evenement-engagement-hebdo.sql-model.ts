import {
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { Authentification } from '../../../domain/authentification'
import { Profil } from '../../../domain/profil'

export class EvenementEngagementHebdoDto extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ field: 'id', type: DataType.INTEGER })
  id?: number

  @Column({ field: 'categorie', type: DataType.STRING })
  categorie: string | null

  @Column({ field: 'action', type: DataType.STRING })
  action: string

  @Column({ field: 'nom', type: DataType.STRING })
  nom: string | null

  @Column({ field: 'code', type: DataType.STRING })
  code: string

  @Column({ field: 'id_utilisateur', type: DataType.STRING })
  idUtilisateur: string

  @Column({ field: 'type_utilisateur', type: DataType.STRING })
  typeUtilisateur: Authentification.Type

  @Column({ field: 'structure', type: DataType.STRING })
  structure: Profil.Structure

  @Column({ field: 'dispositif', type: DataType.STRING })
  dispositif: Profil.Dispositif | null

  @Column({ field: 'date_evenement', type: DataType.DATE })
  dateEvenement: Date
}

@Table({ timestamps: false, tableName: 'evenement_engagement_hebdo' })
export class EvenementEngagementHebdoSqlModel extends EvenementEngagementHebdoDto {}

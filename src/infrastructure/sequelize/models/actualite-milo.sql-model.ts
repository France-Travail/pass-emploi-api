import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { StructureMiloSqlModel } from './structure-milo.sql-model'
import { ConseillerSqlModel } from './conseiller.sql-model'

export class ActualiteMiloDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.UUID })
  id: string

  @ForeignKey(() => StructureMiloSqlModel)
  @Column({ field: 'id_structure_milo', type: DataType.STRING })
  idStructureMilo: string

  @ForeignKey(() => ConseillerSqlModel)
  @Column({ field: 'id_conseiller', type: DataType.STRING })
  idConseiller: string

  @Column({ field: 'titre', type: DataType.STRING(100) })
  titre: string

  @Column({ field: 'contenu', type: DataType.STRING(500) })
  contenu: string

  @Column({ field: 'titre_lien', type: DataType.STRING(50) })
  titreLien: string | null

  @Column({ field: 'lien', type: DataType.STRING(2000) })
  lien: string | null

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'date_modification', type: DataType.DATE })
  dateModification: Date
}

@Table({ timestamps: false, tableName: 'actualite_milo' })
export class ActualiteMiloSqlModel extends ActualiteMiloDto {
  @BelongsTo(() => StructureMiloSqlModel)
  structure?: StructureMiloSqlModel

  @BelongsTo(() => ConseillerSqlModel)
  conseiller?: ConseillerSqlModel
}

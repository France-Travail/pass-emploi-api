import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { JeuneSqlModel } from './jeune.sql-model'
import { PlanActionObjectifSqlModel } from './plan-action-objectif.sql-model'

export class PlanActionDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.UUID })
  id: string

  @ForeignKey(() => JeuneSqlModel)
  @Column({ field: 'id_jeune', type: DataType.STRING })
  idJeune: string

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'date_maj', type: DataType.DATE })
  dateMaj: Date

  @Column({ field: 'structure', type: DataType.STRING })
  structure: string | null

  @Column({ field: 'situation', type: DataType.STRING })
  situation: string | null

  @Column({ field: 'besoins', type: DataType.ARRAY(DataType.STRING) })
  besoins: string[] | null

  @Column({ field: 'contraintes', type: DataType.ARRAY(DataType.STRING) })
  contraintes: string[] | null

  @Column({ field: 'date_naissance', type: DataType.DATEONLY })
  dateNaissance: string | null

  @Column({ field: 'code_insee_commune_residence', type: DataType.STRING })
  codeInseeCommuneResidence: string | null

  @Column({ field: 'nom_commune_residence', type: DataType.STRING })
  nomCommuneResidence: string | null

  @Column({ field: 'code_insee_commune_recherche', type: DataType.STRING })
  codeInseeCommuneRecherche: string | null

  @Column({ field: 'nom_commune_recherche', type: DataType.STRING })
  nomCommuneRecherche: string | null

  @Column({ field: 'domaine_professionnel_vise', type: DataType.TEXT })
  domaineProfessionnelVise: string | null

  @Column({ field: 'rayon_km', type: DataType.FLOAT })
  rayonKm: number | null
}

@Table({ timestamps: false, tableName: 'plan_action' })
export class PlanActionSqlModel extends PlanActionDto {
  @BelongsTo(() => JeuneSqlModel)
  jeune: JeuneSqlModel

  @HasMany(() => PlanActionObjectifSqlModel)
  objectifs: PlanActionObjectifSqlModel[]
}

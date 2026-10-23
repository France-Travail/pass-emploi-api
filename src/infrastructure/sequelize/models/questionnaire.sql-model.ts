import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { JeuneSqlModel } from './jeune.sql-model'

export class QuestionnaireDto extends Model {
  @PrimaryKey
  @ForeignKey(() => JeuneSqlModel)
  @Column({ field: 'id_jeune', type: DataType.STRING })
  idJeune: string

  @Column({ field: 'date_creation', type: DataType.DATE })
  dateCreation: Date

  @Column({ field: 'structure', type: DataType.STRING })
  structure: string

  @Column({ field: 'situation', type: DataType.STRING })
  situation: string

  @Column({ field: 'besoins', type: DataType.ARRAY(DataType.STRING) })
  besoins: string[]

  @Column({ field: 'contraintes', type: DataType.ARRAY(DataType.STRING) })
  contraintes: string[]

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

@Table({ timestamps: false, tableName: 'questionnaire' })
export class QuestionnaireSqlModel extends QuestionnaireDto {
  @BelongsTo(() => JeuneSqlModel)
  jeune: JeuneSqlModel
}

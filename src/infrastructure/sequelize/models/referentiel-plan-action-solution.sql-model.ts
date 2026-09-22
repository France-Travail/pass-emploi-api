import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { ReferentielPlanActionServiceSqlModel } from './referentiel-plan-action-service.sql-model'

export class ReferentielPlanActionSolutionDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'besoin', type: DataType.STRING })
  besoin: string | null

  @Column({ field: 'contrainte', type: DataType.STRING })
  contrainte: string | null

  @Column({ field: 'sous_categorie', type: DataType.STRING })
  sousCategorie: string | null

  @Column({ field: 'besoin_exprime', type: DataType.TEXT })
  besoinExprime: string | null

  @Column({ field: 'type', type: DataType.STRING })
  type: string

  @Column({ field: 'libelle', type: DataType.TEXT })
  libelle: string

  @Column({ field: 'url', type: DataType.TEXT })
  url: string | null

  @Column({ field: 'ecran_app', type: DataType.STRING })
  ecranApp: string | null

  @ForeignKey(() => ReferentielPlanActionServiceSqlModel)
  @Column({ field: 'id_service', type: DataType.STRING })
  idService: string | null

  @Column({ field: 'situations', type: DataType.ARRAY(DataType.STRING) })
  situations: string[]

  @Column({ field: 'authentifications', type: DataType.ARRAY(DataType.STRING) })
  authentifications: string[]

  @Column({ field: 'territoires', type: DataType.ARRAY(DataType.STRING) })
  territoires: string[]

  @Column({ field: 'age_min', type: DataType.INTEGER })
  ageMin: number | null

  @Column({ field: 'age_max', type: DataType.INTEGER })
  ageMax: number | null

  @Column({ field: 'domaine', type: DataType.STRING })
  domaine: string | null

  @Column({ field: 'conversion_ft_thematique', type: DataType.STRING })
  conversionFtThematique: string | null

  @Column({ field: 'conversion_ft_demarche', type: DataType.TEXT })
  conversionFtDemarche: string | null

  @Column({ field: 'conversion_ft_code_pourquoi', type: DataType.STRING })
  conversionFtCodePourquoi: string | null

  @Column({ field: 'conversion_ft_code_quoi', type: DataType.STRING })
  conversionFtCodeQuoi: string | null

  @Column({ field: 'conversion_ml_categorie', type: DataType.STRING })
  conversionMlCategorie: string | null

  @Column({ field: 'conversion_ml_code_categorie', type: DataType.STRING })
  conversionMlCodeCategorie: string | null

  @Column({ field: 'conversion_ml_action', type: DataType.STRING })
  conversionMlAction: string | null

  @Column({ field: 'conversion_ml_origine', type: DataType.STRING })
  conversionMlOrigine: string | null

  @Column({ field: 'active', type: DataType.BOOLEAN })
  active: boolean

  @Column({ field: 'date_maj', type: DataType.DATE })
  dateMaj: Date
}

@Table({ timestamps: false, tableName: 'referentiel_plan_action_solution' })
export class ReferentielPlanActionSolutionSqlModel extends ReferentielPlanActionSolutionDto {
  @BelongsTo(() => ReferentielPlanActionServiceSqlModel)
  service: ReferentielPlanActionServiceSqlModel
}

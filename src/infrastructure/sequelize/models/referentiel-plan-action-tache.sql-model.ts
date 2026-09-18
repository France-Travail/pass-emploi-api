import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export class ReferentielPlanActionTacheDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'label', type: DataType.STRING })
  label: string

  @Column({ field: 'type', type: DataType.STRING })
  type: string

  @Column({ field: 'deeplink', type: DataType.STRING })
  deeplink: string | null

  @Column({ field: 'url', type: DataType.STRING })
  url: string | null

  @Column({ field: 'nom_service', type: DataType.STRING })
  nomService: string | null

  @Column({ field: 'nom_description', type: DataType.STRING })
  nomDescription: string | null
}

@Table({ timestamps: false, tableName: 'referentiel_plan_action_tache' })
export class ReferentielPlanActionTacheSqlModel extends ReferentielPlanActionTacheDto {}

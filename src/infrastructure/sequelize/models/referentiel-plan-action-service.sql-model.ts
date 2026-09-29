import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export class ReferentielPlanActionServiceDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'nom', type: DataType.STRING })
  nom: string

  @Column({ field: 'description', type: DataType.TEXT })
  description: string | null
}

@Table({ timestamps: false, tableName: 'referentiel_plan_action_service' })
export class ReferentielPlanActionServiceSqlModel extends ReferentielPlanActionServiceDto {}

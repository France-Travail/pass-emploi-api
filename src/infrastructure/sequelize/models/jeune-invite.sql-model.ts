import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { AsSql } from '../types'

export class JeuneInviteDto extends Model {
  @PrimaryKey
  @Column({
    field: 'id',
    type: DataType.STRING
  })
  id: string

  @Column({
    field: 'id_authentification',
    type: DataType.STRING
  })
  idAuthentification: string

  @Column({
    field: 'prenom',
    type: DataType.STRING
  })
  prenom: string

  @Column({
    field: 'date_creation',
    type: DataType.DATE
  })
  dateCreation: Date

  @Column({
    field: 'push_notification_token',
    type: DataType.STRING
  })
  pushNotificationToken: string | null

  @Column({
    field: 'date_derniere_actualisation_token',
    type: DataType.DATE
  })
  dateDerniereActualisationToken: Date | null

  @Column({
    field: 'date_derniere_activite',
    type: DataType.DATE,
    allowNull: false
  })
  dateDerniereActivite: Date

  @Column({
    field: 'app_version',
    type: DataType.STRING
  })
  appVersion: string | null

  @Column({
    field: 'installation_id',
    type: DataType.STRING
  })
  installationId: string | null

  @Column({
    field: 'instance_id',
    type: DataType.STRING
  })
  instanceId: string | null

  @Column({
    field: 'timezone',
    type: DataType.STRING
  })
  timezone: string | null

  @Column({
    field: 'date_signature_cgu',
    type: DataType.DATE
  })
  dateSignatureCGU: Date | null
}

@Table({
  timestamps: false,
  tableName: 'jeune_invite'
})
export class JeuneInviteSqlModel extends JeuneInviteDto {
  static async creer(
    jeuneInviteDto: AsSql<JeuneInviteDto>
  ): Promise<JeuneInviteSqlModel> {
    return JeuneInviteSqlModel.create(jeuneInviteDto)
  }
}

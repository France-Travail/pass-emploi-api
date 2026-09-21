import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Communication } from '../../domain/communication'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlCommunicationEnCours,
  sqlJoinConseillersDestinataires
} from './sql-helpers'

@Injectable()
export class CommunicationSqlRepository implements Communication.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getMessageInformatifDuConseiller(
    idConseiller: string,
    maintenant: DateTime
  ): Promise<Communication.MessageInformatif | undefined> {
    const rows = await this.sequelize.query<{
      id: number
      titre: string
      contenu: string
    }>(
      `
        SELECT co.id, co.titre, co.contenu
        FROM communication co
        ${sqlJoinConseillersDestinataires('co', 'c')}
        WHERE c.id = :idConseiller
          AND co.type = :type
          AND ${sqlCommunicationEnCours('co', ':maintenant')}
        ORDER BY co.date_fin ASC
        LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          type: Communication.Type.IN_APP,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows[0]
  }
}

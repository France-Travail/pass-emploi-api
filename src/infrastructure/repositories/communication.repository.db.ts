import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Communication } from '../../domain/communication'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { sqlConseillerDansPopulation } from './sql-helpers'

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
        JOIN conseiller c ON c.id = :idConseiller
        WHERE co.destinataire = :destinataire
          AND co.type = :type
          AND co.date_debut <= :maintenant
          AND :maintenant < co.date_fin
          AND ${sqlConseillerDansPopulation('c', 'co.id_population')}
        ORDER BY co.date_fin ASC
        LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          destinataire: Communication.Destinataire.CONSEILLER,
          type: Communication.Type.IN_APP,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows[0]
  }
}

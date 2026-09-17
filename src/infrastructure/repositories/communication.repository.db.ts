import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Communication } from '../../domain/communication'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlConseillerDansPopulation,
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReferenceDuJeune
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

  async getMessageInformatifDuJeune(
    idJeune: string,
    maintenant: DateTime
  ): Promise<Communication.MessageInformatifJeune | undefined> {
    const rows = await this.sequelize.query<{
      id: number
      titre: string
      contenu: string
      cta_label: string | null
      cta_url_android: string | null
      cta_url_ios: string | null
    }>(
      `
        SELECT co.id, co.titre, co.contenu, co.cta_label, co.cta_url_android, co.cta_url_ios
        FROM communication co
        ${sqlJoinConseillerDeReferenceDuJeune()}
        WHERE co.destinataire = :destinataire
          AND co.type = :type
          AND co.date_debut <= :maintenant
          AND :maintenant < co.date_fin
          AND ${sqlJeuneDansPopulation('j', 'c', 'co.id_population')}
        ORDER BY co.date_fin ASC
        LIMIT 1
      `,
      {
        replacements: {
          idJeune,
          destinataire: Communication.Destinataire.JEUNE,
          type: Communication.Type.IN_APP,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    const row = rows[0]
    if (!row) return undefined

    const message: Communication.MessageInformatifJeune = {
      id: row.id,
      titre: row.titre,
      contenu: row.contenu
    }
    if (row.cta_label && row.cta_url_android && row.cta_url_ios) {
      message.cta = {
        label: row.cta_label,
        urlAndroid: row.cta_url_android,
        urlIos: row.cta_url_ios
      }
    }
    return message
  }
}

import { Op } from 'sequelize'
import { filtreProfils } from '../../../infrastructure/sequelize/filtre-profil'
import { Jeune } from '../../../domain/jeune/jeune'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'
import { PROFILS_FT_CONNECT } from '../../../domain/profil'

export class JeunePoleEmploiSqlRepository
  implements Jeune.PoleEmploi.Repository
{
  async findAll(offset: number, limit: number): Promise<Jeune.PoleEmploi[]> {
    const jeunesSqlModel = await JeuneSqlModel.findAll({
      where: {
        ...filtreProfils(PROFILS_FT_CONNECT),
        pushNotificationToken: { [Op.ne]: null },
        notificationsRendezVousSessions: true,
        idAuthentification: { [Op.ne]: null }
      },
      order: [['id', 'ASC']],
      offset,
      limit
    })

    return jeunesSqlModel.map(jeuneSql => {
      return {
        id: jeuneSql.id,
        idAuthentification: jeuneSql.idAuthentification,
        pushNotificationToken: jeuneSql.pushNotificationToken!
      }
    })
  }
}

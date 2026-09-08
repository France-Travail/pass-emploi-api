import { Op } from 'sequelize'
import { Jeune } from '../../../domain/jeune/jeune'
import { PROFILS_FT_CONNECT } from '../../../domain/profil'
import { filtreStructuresEtDispositifs } from '../../sequelize/filtre-structures-dispositifs'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'

export class JeunePoleEmploiSqlRepository
  implements Jeune.PoleEmploi.Repository
{
  async findAll(offset: number, limit: number): Promise<Jeune.PoleEmploi[]> {
    const jeunesSqlModel = await JeuneSqlModel.findAll({
      where: {
        ...filtreStructuresEtDispositifs(PROFILS_FT_CONNECT),
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

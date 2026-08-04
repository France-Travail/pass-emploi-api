import { Injectable } from '@nestjs/common'
import { Op, Sequelize } from 'sequelize'
import { JeuneInvite } from '../../../domain/jeune/jeune-invite'
import { JeuneInviteSqlModel } from '../../sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteSqlRepository implements JeuneInvite.Repository {
  async existe(id: string): Promise<boolean> {
    const nombre = await JeuneInviteSqlModel.count({ where: { id } })
    return nombre > 0
  }

  async recupererInvitesInactifs(
    dateSeuil: Date,
    limite: number
  ): Promise<
    Array<{ id: string; idAuthentification: string; dateReference: Date }>
  > {
    const invites = await JeuneInviteSqlModel.findAll({
      attributes: [
        'id',
        'idAuthentification',
        [
          Sequelize.fn(
            'GREATEST',
            Sequelize.col('date_derniere_actualisation_token'),
            Sequelize.col('date_creation')
          ),
          'dateReference'
        ]
      ],
      where: Sequelize.where(
        Sequelize.fn(
          'GREATEST',
          Sequelize.col('date_derniere_actualisation_token'),
          Sequelize.col('date_creation')
        ),
        { [Op.lt]: dateSeuil }
      ),
      limit: limite
    })
    return invites.map(invite => ({
      id: invite.id,
      idAuthentification: invite.idAuthentification,
      dateReference: invite.get('dateReference') as Date
    }))
  }

  async compterTout(): Promise<number> {
    return JeuneInviteSqlModel.count()
  }

  async compterInvitesInactifs(dateSeuil: Date): Promise<number> {
    return JeuneInviteSqlModel.count({
      where: Sequelize.where(
        Sequelize.fn(
          'GREATEST',
          Sequelize.col('date_derniere_actualisation_token'),
          Sequelize.col('date_creation')
        ),
        { [Op.lt]: dateSeuil }
      )
    })
  }

  async supprimer(id: string): Promise<void> {
    await JeuneInviteSqlModel.destroy({ where: { id } })
  }
}

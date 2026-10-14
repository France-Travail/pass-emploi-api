import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Op } from 'sequelize'
import { JeuneInvite } from '../../../domain/jeune/jeune-invite'
import { JeuneInviteSqlModel } from '../../sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteSqlRepository implements JeuneInvite.Repository {
  async existe(id: string): Promise<boolean> {
    const nombre = await JeuneInviteSqlModel.count({ where: { id } })
    return nombre > 0
  }

  async recupererInvitesInactifs(
    dateSeuil: Date
  ): Promise<
    Array<{ id: string; idAuthentification: string; dateReference: Date }>
  > {
    const invites = await JeuneInviteSqlModel.findAll({
      attributes: [
        'id',
        'idAuthentification',
        'dateDerniereActivite',
        'dateCreation'
      ],
      where: {
        [Op.or]: [
          { dateDerniereActivite: { [Op.lt]: dateSeuil } },
          { dateDerniereActivite: null, dateCreation: { [Op.lt]: dateSeuil } }
        ]
      }
    })
    return invites.map(invite => ({
      id: invite.id,
      idAuthentification: invite.idAuthentification,
      dateReference: invite.dateDerniereActivite ?? invite.dateCreation
    }))
  }

  async compterTout(): Promise<number> {
    return JeuneInviteSqlModel.count()
  }

  async supprimerPlusieurs(ids: string[]): Promise<void> {
    await JeuneInviteSqlModel.destroy({ where: { id: { [Op.in]: ids } } })
  }

  async recupererPourReprise(
    id: string
  ): Promise<JeuneInvite.PourReprise | undefined> {
    const invite = await JeuneInviteSqlModel.findByPk(id, {
      attributes: ['id', 'dateCreation', 'dateReprise']
    })
    if (!invite) return undefined
    return {
      id: invite.id,
      dateCreation: DateTime.fromJSDate(invite.dateCreation),
      ...(invite.dateReprise
        ? { dateReprise: DateTime.fromJSDate(invite.dateReprise) }
        : {})
    }
  }

  // Conditionnel : deux reprises concurrentes du même invité ne peuvent pas
  // réussir toutes les deux. false = l'invité était déjà repris (ou n'existe plus)
  async marquerRepris(id: string, dateReprise: DateTime): Promise<boolean> {
    const [nombreMisAJour] = await JeuneInviteSqlModel.update(
      { dateReprise: dateReprise.toJSDate() },
      { where: { id, dateReprise: null } }
    )
    return nombreMisAJour > 0
  }

  async recupererInvitesRepris(): Promise<JeuneInvite.PourPurge[]> {
    const invites = await JeuneInviteSqlModel.findAll({
      attributes: ['id', 'idAuthentification'],
      where: { dateReprise: { [Op.ne]: null } }
    })
    return invites.map(({ id, idAuthentification }) => ({
      id,
      idAuthentification
    }))
  }
}

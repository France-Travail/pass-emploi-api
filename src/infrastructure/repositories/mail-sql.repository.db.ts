import { Injectable } from '@nestjs/common'
import { Op } from 'sequelize'
import { Mail } from '../../domain/mail'
import { ConseillerSqlModel } from '../sequelize/models/conseiller.sql-model'
import { filtreStructureEtDispositifs } from '../sequelize/filtre-structures-dispositifs'
import { StructureEtDispositifs } from '../../domain/profil'

@Injectable()
export class MailSqlRepository implements Mail.Repository {
  async findAllContactsConseillerParProfil(
    structureEtDispositifs: StructureEtDispositifs
  ): Promise<Mail.Contact[]> {
    const conseillersSQL = await ConseillerSqlModel.findAll({
      raw: true,
      attributes: ['nom', 'prenom', 'email'],
      where: {
        [Op.and]: [
          filtreStructureEtDispositifs(structureEtDispositifs),
          { email: { [Op.not]: null } }
        ]
      }
    })
    // Solution plus lisible/maintenable mais moins performante
    const contacts: Mail.Contact[] = conseillersSQL.map(conseillerSQL => ({
      nom: conseillerSQL.nom,
      prenom: conseillerSQL.prenom,
      email: conseillerSQL.email!.replace(/pole-emploi/g, 'francetravail')
    }))
    return contacts
  }

  async countContactsConseillerSansEmail(): Promise<number> {
    return ConseillerSqlModel.count({ where: { email: null } })
  }
}

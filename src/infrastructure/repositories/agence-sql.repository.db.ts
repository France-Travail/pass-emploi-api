import { Injectable } from '@nestjs/common'
import { Agence } from '../../domain/agence'
import { Core } from '../../domain/core'
import { Conseiller } from '../../domain/milo/conseiller'
import { AgenceSqlModel } from '../sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../sequelize/models/conseiller.sql-model'
import Structure = Core.Structure

@Injectable()
export class AgenceSqlRepository implements Agence.Repository {
  async get(id: string, structure: Structure): Promise<Agence | undefined> {
    const agenceSql = await AgenceSqlModel.findOne({
      where: {
        id: id,
        structure: structure
      }
    })
    if (!agenceSql) {
      return undefined
    }
    return {
      id: agenceSql.id,
      nom: agenceSql.nomAgence
    }
  }
  async findAllConseillersByAgence(idAgence: string): Promise<Conseiller[]> {
    const conseillersSql = await ConseillerSqlModel.findAll({
      where: {
        idAgence
      }
    })
    return conseillersSql.map(conseillerSql => {
      return {
        id: conseillerSql.id,
        firstName: conseillerSql.prenom,
        lastName: conseillerSql.nom,
        structure: conseillerSql.structure,
        email: conseillerSql.email ?? undefined,
        notificationsSonores: conseillerSql.notificationsSonores,
        agence: {
          id: conseillerSql.idAgence ?? undefined,
          nom: undefined
        }
      }
    })
  }
}

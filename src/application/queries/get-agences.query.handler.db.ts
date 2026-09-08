import { Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { DISPOSITIFS_ACCOMPAGNES, Profil } from '../../domain/profil'
import { AgenceSqlModel } from '../../infrastructure/sequelize/models/agence.sql-model'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { AgenceQueryModel } from './query-models/agence.query-model'

export interface GetAgenceQuery extends Query {
  structure: Profil.Structure
}

@Injectable()
export class GetAgencesQueryHandler extends QueryHandler<
  GetAgenceQuery,
  AgenceQueryModel[]
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(private readonly conseillerAuthorizer: ConseillerAuthorizer) {
    super('GetAgencesQueryHandler')
  }

  async handle(query: GetAgenceQuery): Promise<AgenceQueryModel[]> {
    const sqlModels = await AgenceSqlModel.findAll({
      where: {
        structure: query.structure
      }
    })
    return sqlModels.map(sql => {
      return {
        id: sql.id,
        nom: sql.nomAgence,
        codeDepartement: sql.codeDepartement
      }
    })
  }

  async authorize(
    query: GetAgenceQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserToutConseiller(
      utilisateur,
      query.structure === utilisateur.profil.structure
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

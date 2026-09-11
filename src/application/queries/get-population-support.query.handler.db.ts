import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../building-blocks/types/result'
import { DeploiementSqlModel } from '../../infrastructure/sequelize/models/deploiement.sql-model'
import { PopulationConseillerSqlModel } from '../../infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../infrastructure/sequelize/models/population.sql-model'
import { PopulationSupportQueryModel } from './query-models/population-support.query-model'

export interface GetPopulationSupportQuery extends Query {
  idPopulation: string
}

@Injectable()
export class GetPopulationSupportQueryHandler extends QueryHandler<
  GetPopulationSupportQuery,
  Result<PopulationSupportQueryModel>
> {
  constructor() {
    super('GetPopulationSupportQueryHandler')
  }

  async handle(
    query: GetPopulationSupportQuery
  ): Promise<Result<PopulationSupportQueryModel>> {
    const population = await PopulationSqlModel.findByPk(query.idPopulation)
    if (!population) {
      return failure(new NonTrouveError('Population', query.idPopulation))
    }

    const where = { idPopulation: query.idPopulation }
    const [conseillers, profils, deploiements] = await Promise.all([
      PopulationConseillerSqlModel.findAll({
        where,
        order: [['emailConseiller', 'ASC']]
      }),
      PopulationProfilSqlModel.findAll({ where, order: [['id', 'ASC']] }),
      DeploiementSqlModel.findAll({ where, order: [['id', 'ASC']] })
    ])

    return success({
      id: population.id,
      description: population.description ?? undefined,
      conseillers: conseillers.map(c => c.emailConseiller),
      profils: profils.map(p => ({
        structure: p.structure,
        dispositif: p.dispositif ?? undefined
      })),
      deploiements: deploiements.map(d => ({
        id: d.id,
        nature: d.nature,
        idFonctionnalite: d.idFonctionnalite ?? undefined,
        dateActivation: DateTime.fromJSDate(d.dateActivation).toUTC().toISO()!
      }))
    })
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

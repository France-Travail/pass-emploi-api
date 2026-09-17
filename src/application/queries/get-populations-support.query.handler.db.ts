import { Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import { DeploiementSqlModel } from '../../infrastructure/sequelize/models/deploiement.sql-model'
import { PopulationAgenceFTSqlModel } from '../../infrastructure/sequelize/models/population-agence-ft.sql-model'
import { PopulationConseillerSqlModel } from '../../infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationStructureMiloSqlModel } from '../../infrastructure/sequelize/models/population-structure-milo.sql-model'
import { PopulationSqlModel } from '../../infrastructure/sequelize/models/population.sql-model'
import { toPopulationSupportQueryModel } from './get-population-support.query.handler.db'
import { PopulationSupportQueryModel } from './query-models/population-support.query-model'

// Lecture support : toutes les populations avec leurs cibles et leurs déploiements, pour savoir quoi viser.
@Injectable()
export class GetPopulationsSupportQueryHandler extends QueryHandler<
  Query,
  Result<PopulationSupportQueryModel[]>
> {
  constructor() {
    super('GetPopulationsSupportQueryHandler')
  }

  async handle(): Promise<Result<PopulationSupportQueryModel[]>> {
    const [
      populations,
      conseillers,
      profils,
      structuresMilo,
      agences,
      deploiements
    ] = await Promise.all([
      PopulationSqlModel.findAll({ order: [['id', 'ASC']] }),
      PopulationConseillerSqlModel.findAll({
        order: [['emailConseiller', 'ASC']]
      }),
      PopulationProfilSqlModel.findAll({ order: [['id', 'ASC']] }),
      PopulationStructureMiloSqlModel.findAll({
        order: [['idStructureMilo', 'ASC']]
      }),
      PopulationAgenceFTSqlModel.findAll({ order: [['idAgence', 'ASC']] }),
      DeploiementSqlModel.findAll({ order: [['id', 'ASC']] })
    ])

    return success(
      populations.map(population =>
        toPopulationSupportQueryModel(
          population,
          conseillers.filter(c => c.idPopulation === population.id),
          profils.filter(p => p.idPopulation === population.id),
          structuresMilo.filter(s => s.idPopulation === population.id),
          agences.filter(a => a.idPopulation === population.id),
          deploiements.filter(d => d.idPopulation === population.id)
        )
      )
    )
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

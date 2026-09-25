import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { DeploiementSqlModel } from '../../infrastructure/sequelize/models/deploiement.sql-model'
import { PopulationConseillerSqlModel } from '../../infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../infrastructure/sequelize/models/population.sql-model'
import {
  envoiDe,
  toPopulationSupportQueryModel
} from './get-population-support.query.handler.db'
import { PopulationSupportQueryModel } from './query-models/population-support.query-model'

// Lecture support : toutes les populations avec leurs cibles et leurs déploiements, pour savoir quoi viser.
@Injectable()
export class GetPopulationsSupportQueryHandler extends QueryHandler<
  Query,
  Result<PopulationSupportQueryModel[]>
> {
  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository
  ) {
    super('GetPopulationsSupportQueryHandler')
  }

  async handle(): Promise<Result<PopulationSupportQueryModel[]>> {
    const [populations, conseillers, profils, deploiements, communications] =
      await Promise.all([
        PopulationSqlModel.findAll({ order: [['id', 'ASC']] }),
        PopulationConseillerSqlModel.findAll({
          order: [['emailConseiller', 'ASC']]
        }),
        PopulationProfilSqlModel.findAll({ order: [['id', 'ASC']] }),
        DeploiementSqlModel.findAll({ order: [['id', 'ASC']] }),
        CommunicationSqlModel.findAll({ order: [['id', 'ASC']] })
      ])
    const envois = await Promise.all(
      communications.map(co => envoiDe(co, this.communicationRepository))
    )

    return success(
      populations.map(population => {
        const communicationsDeLaPopulation = communications.filter(
          co => co.idPopulation === population.id
        )
        return toPopulationSupportQueryModel(
          population,
          conseillers.filter(c => c.idPopulation === population.id),
          profils.filter(p => p.idPopulation === population.id),
          deploiements.filter(d => d.idPopulation === population.id),
          communicationsDeLaPopulation,
          communicationsDeLaPopulation.map(
            co => envois[communications.indexOf(co)]
          )
        )
      })
    )
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

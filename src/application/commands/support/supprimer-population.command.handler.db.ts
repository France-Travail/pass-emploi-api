import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'
import { DeploiementSqlModel } from '../../../infrastructure/sequelize/models/deploiement.sql-model'
import { PopulationSqlModel } from '../../../infrastructure/sequelize/models/population.sql-model'

export interface SupprimerPopulationCommand extends Command {
  id: string
}

@Injectable()
export class SupprimerPopulationCommandHandler extends CommandHandler<
  SupprimerPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('SupprimerPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Les cibles partent en cascade, pas un déploiement ni une communication : les supprimer d'abord évite une désactivation par accident.
  async handle(command: SupprimerPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.id))) {
      return failure(new NonTrouveError('Population', command.id))
    }

    const nombreDeDeploiements = await DeploiementSqlModel.count({
      where: { idPopulation: command.id }
    })
    if (nombreDeDeploiements > 0) {
      return failure(
        new MauvaiseCommandeError(
          `La population ${command.id} est visée par ${nombreDeDeploiements} déploiement(s), les supprimer d'abord`
        )
      )
    }

    const nombreDeCommunications = await CommunicationSqlModel.count({
      where: { idPopulation: command.id }
    })
    if (nombreDeCommunications > 0) {
      return failure(
        new MauvaiseCommandeError(
          `La population ${command.id} est visée par ${nombreDeCommunications} communication(s), les supprimer d'abord`
        )
      )
    }

    await PopulationSqlModel.destroy({ where: { id: command.id } })
    return emptySuccess()
  }
}

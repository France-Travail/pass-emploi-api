import { Injectable } from '@nestjs/common'
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
  constructor() {
    super('SupprimerPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Les cibles partent en cascade, pas un déploiement : le supprimer d'abord évite une désactivation par accident.
  async handle(command: SupprimerPopulationCommand): Promise<Result> {
    const population = await PopulationSqlModel.findByPk(command.id)
    if (!population) {
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

    await population.destroy()
    return emptySuccess()
  }
}

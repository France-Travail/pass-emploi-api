import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { PopulationStructureMiloSqlModel } from '../../../infrastructure/sequelize/models/population-structure-milo.sql-model'
import { StructureMiloSqlModel } from '../../../infrastructure/sequelize/models/structure-milo.sql-model'

export interface StructureMiloPopulationCommand extends Command {
  idPopulation: string
  idStructureMilo: string
}

@Injectable()
export class AjouterStructureMiloPopulationCommandHandler extends CommandHandler<
  StructureMiloPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('AjouterStructureMiloPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Une structure MiLo cible ses conseillers et ses jeunes, chacun par son propre rattachement. Doublon ignoré.
  async handle(command: StructureMiloPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }
    if (!(await StructureMiloSqlModel.findByPk(command.idStructureMilo))) {
      return failure(
        new NonTrouveError('Structure MiLo', command.idStructureMilo)
      )
    }

    await PopulationStructureMiloSqlModel.findOrCreate({
      where: {
        idPopulation: command.idPopulation,
        idStructureMilo: command.idStructureMilo
      }
    })
    return emptySuccess()
  }
}

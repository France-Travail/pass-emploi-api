import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationStructureMiloSqlModel } from '../../../infrastructure/sequelize/models/population-structure-milo.sql-model'
import { StructureMiloPopulationCommand } from './ajouter-structure-milo-population.command.handler.db'

@Injectable()
export class SupprimerStructureMiloPopulationCommandHandler extends CommandHandler<
  StructureMiloPopulationCommand,
  void
> {
  constructor() {
    super('SupprimerStructureMiloPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: StructureMiloPopulationCommand): Promise<Result> {
    const nombreDeSuppressions = await PopulationStructureMiloSqlModel.destroy({
      where: {
        idPopulation: command.idPopulation,
        idStructureMilo: command.idStructureMilo
      }
    })
    if (nombreDeSuppressions === 0) {
      return failure(
        new NonTrouveError(
          'Structure MiLo de la population',
          `${command.idPopulation}/${command.idStructureMilo}`
        )
      )
    }
    return emptySuccess()
  }
}

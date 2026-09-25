import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationStructureMiloSqlModel } from '../../../infrastructure/sequelize/models/population-structure-milo.sql-model'

export interface SupprimerStructureMiloPopulationCommand extends Command {
  idPopulation: string
  idStructureMilo: string
}

@Injectable()
export class SupprimerStructureMiloPopulationCommandHandler extends CommandHandler<
  SupprimerStructureMiloPopulationCommand,
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

  // Retire la structure de la population, quels que soient ses dispositifs.
  async handle(
    command: SupprimerStructureMiloPopulationCommand
  ): Promise<Result> {
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

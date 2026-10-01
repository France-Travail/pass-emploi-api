import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationAgenceFTSqlModel } from '../../../infrastructure/sequelize/models/population-agence-ft.sql-model'

export interface SupprimerAgenceFTPopulationCommand extends Command {
  idPopulation: string
  idAgence: string
}

@Injectable()
export class SupprimerAgenceFTPopulationCommandHandler extends CommandHandler<
  SupprimerAgenceFTPopulationCommand,
  void
> {
  constructor() {
    super('SupprimerAgenceFTPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Retire l'agence de la population, quels que soient ses dispositifs.
  async handle(command: SupprimerAgenceFTPopulationCommand): Promise<Result> {
    const nombreDeSuppressions = await PopulationAgenceFTSqlModel.destroy({
      where: { idPopulation: command.idPopulation, idAgence: command.idAgence }
    })
    if (nombreDeSuppressions === 0) {
      return failure(
        new NonTrouveError(
          'Agence de la population',
          `${command.idPopulation}/${command.idAgence}`
        )
      )
    }
    return emptySuccess()
  }
}

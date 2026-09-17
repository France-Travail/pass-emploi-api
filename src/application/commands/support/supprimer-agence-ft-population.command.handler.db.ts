import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationAgenceFTSqlModel } from '../../../infrastructure/sequelize/models/population-agence-ft.sql-model'
import { AgenceFTPopulationCommand } from './ajouter-agence-ft-population.command.handler.db'

@Injectable()
export class SupprimerAgenceFTPopulationCommandHandler extends CommandHandler<
  AgenceFTPopulationCommand,
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

  async handle(command: AgenceFTPopulationCommand): Promise<Result> {
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

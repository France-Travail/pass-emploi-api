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

export interface SupprimerAgencesFTPopulationCommand extends Command {
  idPopulation: string
  idAgences: string[]
}

@Injectable()
export class SupprimerAgencesFTPopulationCommandHandler extends CommandHandler<
  SupprimerAgencesFTPopulationCommand,
  void
> {
  constructor() {
    super('SupprimerAgencesFTPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: SupprimerAgencesFTPopulationCommand): Promise<Result> {
    const idsUniques = Array.from(new Set(command.idAgences))
    const agencesPresentes = await PopulationAgenceFTSqlModel.findAll({
      attributes: ['idAgence'],
      where: { idPopulation: command.idPopulation, idAgence: idsUniques }
    })
    const idsPresents = new Set(
      agencesPresentes.map(({ idAgence }) => idAgence)
    )
    const idsAbsents = idsUniques.filter(id => !idsPresents.has(id))
    if (idsAbsents.length) {
      return failure(
        new NonTrouveError(
          'Agence de la population',
          `${command.idPopulation}/${idsAbsents.join(', ')}`
        )
      )
    }

    await PopulationAgenceFTSqlModel.destroy({
      where: { idPopulation: command.idPopulation, idAgence: idsUniques }
    })
    return emptySuccess()
  }
}

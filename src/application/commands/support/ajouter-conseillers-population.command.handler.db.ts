import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationConseillerSqlModel } from '../../../infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationSqlModel } from '../../../infrastructure/sequelize/models/population.sql-model'

export interface AjouterConseillersPopulationCommand extends Command {
  idPopulation: string
  emailConseillers: string[]
}

@Injectable()
export class AjouterConseillersPopulationCommandHandler extends CommandHandler<
  AjouterConseillersPopulationCommand,
  void
> {
  constructor() {
    super('AjouterConseillersPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: AjouterConseillersPopulationCommand): Promise<Result> {
    const population = await PopulationSqlModel.findByPk(command.idPopulation)
    if (!population) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    const emailsUniques = Array.from(new Set(command.emailConseillers))
    await PopulationConseillerSqlModel.bulkCreate(
      emailsUniques.map(emailConseiller => ({
        idPopulation: command.idPopulation,
        emailConseiller
      })),
      { ignoreDuplicates: true }
    )

    return emptySuccess()
  }
}

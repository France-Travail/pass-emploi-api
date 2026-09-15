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
import { PopulationConseillerSqlModel } from '../../../infrastructure/sequelize/models/population-conseiller.sql-model'

export interface AjouterConseillersPopulationCommand extends Command {
  idPopulation: string
  emailConseillers: string[]
}

@Injectable()
export class AjouterConseillersPopulationCommandHandler extends CommandHandler<
  AjouterConseillersPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('AjouterConseillersPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: AjouterConseillersPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
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

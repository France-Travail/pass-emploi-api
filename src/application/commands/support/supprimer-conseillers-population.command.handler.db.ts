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
import { PopulationConseillerSqlModel } from '../../../infrastructure/sequelize/models/population-conseiller.sql-model'

export interface SupprimerConseillersPopulationCommand extends Command {
  idPopulation: string
  emailConseillers?: string[]
  supprimerTous?: boolean
}

@Injectable()
export class SupprimerConseillersPopulationCommandHandler extends CommandHandler<
  SupprimerConseillersPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('SupprimerConseillersPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: SupprimerConseillersPopulationCommand
  ): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    if (command.supprimerTous) {
      await PopulationConseillerSqlModel.destroy({
        where: { idPopulation: command.idPopulation }
      })
      return emptySuccess()
    }

    // Sans liste ni drapeau on refuse plutôt que de vider la population par accident.
    if (!command.emailConseillers?.length) {
      return failure(
        new MauvaiseCommandeError(
          'Renseigner emailConseillers ou supprimerTous'
        )
      )
    }

    await PopulationConseillerSqlModel.destroy({
      where: {
        idPopulation: command.idPopulation,
        emailConseiller: command.emailConseillers
      }
    })
    return emptySuccess()
  }
}

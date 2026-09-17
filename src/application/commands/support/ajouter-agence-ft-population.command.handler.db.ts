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
import { Profil } from '../../../domain/profil'
import { AgenceSqlModel } from '../../../infrastructure/sequelize/models/agence.sql-model'
import { PopulationAgenceFTSqlModel } from '../../../infrastructure/sequelize/models/population-agence-ft.sql-model'

export interface AgenceFTPopulationCommand extends Command {
  idPopulation: string
  idAgence: string
}

@Injectable()
export class AjouterAgenceFTPopulationCommandHandler extends CommandHandler<
  AgenceFTPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('AjouterAgenceFTPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Une agence FT cible ses conseillers et leurs jeunes de référence : un jeune n'a pas d'agence. Doublon ignoré.
  async handle(command: AgenceFTPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }
    const agence = await AgenceSqlModel.findByPk(command.idAgence)
    if (!agence) {
      return failure(new NonTrouveError('Agence', command.idAgence))
    }
    if (agence.structure !== Profil.Structure.FRANCE_TRAVAIL) {
      return failure(
        new MauvaiseCommandeError(
          `L'agence ${command.idAgence} n'est pas une agence France Travail`
        )
      )
    }

    await PopulationAgenceFTSqlModel.findOrCreate({
      where: { idPopulation: command.idPopulation, idAgence: command.idAgence }
    })
    return emptySuccess()
  }
}

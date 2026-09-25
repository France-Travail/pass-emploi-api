import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { Profil } from '../../../domain/profil'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { PopulationProfilSqlModel } from '../../../infrastructure/sequelize/models/population-profil.sql-model'

export interface AjouterProfilPopulationCommand extends Command {
  idPopulation: string
  structure: Profil.Structure
  dispositif?: Profil.Dispositif
}

@Injectable()
export class AjouterProfilPopulationCommandHandler extends CommandHandler<
  AjouterProfilPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('AjouterProfilPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Sans dispositif le profil couvre toute la structure ; un profil déjà présent est laissé tel quel.
  async handle(command: AjouterProfilPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    await PopulationProfilSqlModel.findOrCreate({
      where: {
        idPopulation: command.idPopulation,
        structure: command.structure,
        dispositif: command.dispositif ?? null
      }
    })

    return emptySuccess()
  }
}

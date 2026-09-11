import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { Profil } from '../../../domain/profil'
import { PopulationProfilSqlModel } from '../../../infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../infrastructure/sequelize/models/population.sql-model'

export interface SupprimerProfilPopulationCommand extends Command {
  idPopulation: string
  structure: Profil.Structure
  dispositif?: Profil.Dispositif
}

@Injectable()
export class SupprimerProfilPopulationCommandHandler extends CommandHandler<
  SupprimerProfilPopulationCommand,
  void
> {
  constructor() {
    super('SupprimerProfilPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: SupprimerProfilPopulationCommand): Promise<Result> {
    const population = await PopulationSqlModel.findByPk(command.idPopulation)
    if (!population) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    await PopulationProfilSqlModel.destroy({
      where: {
        idPopulation: command.idPopulation,
        structure: command.structure,
        dispositif: command.dispositif ?? null
      }
    })

    return emptySuccess()
  }
}

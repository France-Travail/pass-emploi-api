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
    const nombreDeSuppressions = await PopulationProfilSqlModel.destroy({
      where: {
        idPopulation: command.idPopulation,
        structure: command.structure,
        dispositif: command.dispositif ?? null
      }
    })
    if (nombreDeSuppressions === 0) {
      return failure(
        new NonTrouveError(
          'Profil',
          [command.idPopulation, command.structure, command.dispositif]
            .filter(Boolean)
            .join('/')
        )
      )
    }
    return emptySuccess()
  }
}

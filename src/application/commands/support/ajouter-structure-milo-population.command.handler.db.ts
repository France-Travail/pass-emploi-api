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
import { PopulationStructureMiloSqlModel } from '../../../infrastructure/sequelize/models/population-structure-milo.sql-model'
import { StructureMiloSqlModel } from '../../../infrastructure/sequelize/models/structure-milo.sql-model'

export interface StructuresMiloPopulationCommand extends Command {
  idPopulation: string
  idStructuresMilo: string[]
}

@Injectable()
export class AjouterStructureMiloPopulationCommandHandler extends CommandHandler<
  StructuresMiloPopulationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('AjouterStructureMiloPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Une structure MiLo cible ses conseillers, et leurs jeunes par leur conseiller de référence. Doublon ignoré.
  async handle(command: StructuresMiloPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    const idsUniques = Array.from(new Set(command.idStructuresMilo))
    const structuresExistantes = await StructureMiloSqlModel.findAll({
      attributes: ['id'],
      where: { id: idsUniques }
    })
    const idsExistants = new Set(structuresExistantes.map(({ id }) => id))
    const idsInconnus = idsUniques.filter(id => !idsExistants.has(id))
    if (idsInconnus.length) {
      return failure(
        new NonTrouveError('Structure MiLo', idsInconnus.join(', '))
      )
    }

    await PopulationStructureMiloSqlModel.bulkCreate(
      idsUniques.map(idStructureMilo => ({
        idPopulation: command.idPopulation,
        idStructureMilo
      })),
      { ignoreDuplicates: true }
    )
    return emptySuccess()
  }
}

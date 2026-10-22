import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { PopulationStructureMiloSqlModel } from '../../../infrastructure/sequelize/models/population-structure-milo.sql-model'
import { StructuresMiloPopulationCommand } from './ajouter-structures-milo-population.command.handler.db'

@Injectable()
export class SupprimerStructuresMiloPopulationCommandHandler extends CommandHandler<
  StructuresMiloPopulationCommand,
  void
> {
  constructor() {
    super('SupprimerStructuresMiloPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: StructuresMiloPopulationCommand): Promise<Result> {
    const idsUniques = Array.from(new Set(command.idStructuresMilo))
    const structuresPresentes = await PopulationStructureMiloSqlModel.findAll({
      attributes: ['idStructureMilo'],
      where: {
        idPopulation: command.idPopulation,
        idStructureMilo: idsUniques
      }
    })
    const idsPresents = new Set(
      structuresPresentes.map(({ idStructureMilo }) => idStructureMilo)
    )
    const idsAbsents = idsUniques.filter(id => !idsPresents.has(id))
    if (idsAbsents.length) {
      return failure(
        new NonTrouveError(
          'Structure MiLo de la population',
          `${command.idPopulation}/${idsAbsents.join(', ')}`
        )
      )
    }

    await PopulationStructureMiloSqlModel.destroy({
      where: {
        idPopulation: command.idPopulation,
        idStructureMilo: idsUniques
      }
    })
    return emptySuccess()
  }
}

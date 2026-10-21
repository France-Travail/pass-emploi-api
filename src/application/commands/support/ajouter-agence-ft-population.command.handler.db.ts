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

export interface AjouterAgencesFTPopulationCommand extends Command {
  idPopulation: string
  idAgences: string[]
  dispositifs?: Profil.Dispositif[]
}

@Injectable()
export class AjouterAgenceFTPopulationCommandHandler extends CommandHandler<
  AjouterAgencesFTPopulationCommand,
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

  // Une agence FT cible ses conseillers et leurs jeunes de référence : un jeune n'a pas d'agence. Rejouer remplace la liste de dispositifs ; absente, toute l'agence est visée.
  async handle(command: AjouterAgencesFTPopulationCommand): Promise<Result> {
    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }

    const idsUniques = Array.from(new Set(command.idAgences))
    const agences = await AgenceSqlModel.findAll({
      attributes: ['id', 'structure'],
      where: { id: idsUniques }
    })
    const idsExistants = new Set(agences.map(({ id }) => id))
    const idsInconnus = idsUniques.filter(id => !idsExistants.has(id))
    if (idsInconnus.length) {
      return failure(new NonTrouveError('Agence', idsInconnus.join(', ')))
    }
    const idsHorsFT = agences
      .filter(({ structure }) => structure !== Profil.Structure.FRANCE_TRAVAIL)
      .map(({ id }) => id)
    if (idsHorsFT.length) {
      return failure(
        new MauvaiseCommandeError(
          `Pas des agences France Travail : ${idsHorsFT.join(', ')}`
        )
      )
    }

    await PopulationAgenceFTSqlModel.bulkCreate(
      idsUniques.map(idAgence => ({
        idPopulation: command.idPopulation,
        idAgence,
        dispositifs: command.dispositifs ?? null
      })),
      { updateOnDuplicate: ['dispositifs'] }
    )
    return emptySuccess()
  }
}

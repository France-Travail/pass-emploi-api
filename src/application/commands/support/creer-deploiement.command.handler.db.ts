import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Deploiement } from '../../../domain/deploiement'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { DeploiementSqlModel } from '../../../infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite.sql-model'

export interface CreerDeploiementCommand extends Command {
  nature: Deploiement.Nature
  idPopulation: string
  idFonctionnalite?: string
  dateActivation: DateTime
}

export interface DeploiementCree {
  id: number
}

@Injectable()
export class CreerDeploiementCommandHandler extends CommandHandler<
  CreerDeploiementCommand,
  DeploiementCree
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('CreerDeploiementCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Unique par (population, fonctionnalité) et une seule migration par population : rejouer déplace la date au lieu de doublonner.
  async handle(
    command: CreerDeploiementCommand
  ): Promise<Result<DeploiementCree>> {
    const deploiementResult = Deploiement.creer(command)
    if (isFailure(deploiementResult)) return deploiementResult
    const deploiement = deploiementResult.data

    if (!(await this.populationRepository.existe(deploiement.idPopulation))) {
      return failure(new NonTrouveError('Population', deploiement.idPopulation))
    }
    if (deploiement.idFonctionnalite) {
      const fonctionnalite = await FonctionnaliteSqlModel.findByPk(
        deploiement.idFonctionnalite
      )
      if (!fonctionnalite) {
        return failure(
          new NonTrouveError('Fonctionnalité', deploiement.idFonctionnalite)
        )
      }
    }

    // Un seul INSERT … ON CONFLICT sur l'index unique partiel de la nature : atomique, pas de fenêtre entre lecture et écriture.
    const [enregistre] = await DeploiementSqlModel.upsert(
      {
        nature: deploiement.nature,
        idPopulation: deploiement.idPopulation,
        idFonctionnalite: deploiement.idFonctionnalite ?? null,
        dateActivation: deploiement.dateActivation.toJSDate()
      },
      {
        conflictFields:
          deploiement.nature === Deploiement.Nature.FONCTIONNALITE
            ? ['id_population', 'id_fonctionnalite']
            : ['id_population'],
        conflictWhere: { nature: deploiement.nature }
      }
    )
    return success({ id: enregistre.id })
  }
}

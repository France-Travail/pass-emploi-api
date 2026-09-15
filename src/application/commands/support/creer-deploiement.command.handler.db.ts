import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
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
    const coherenceResult = verifierCoherence(command)
    if (coherenceResult) return coherenceResult

    if (!(await this.populationRepository.existe(command.idPopulation))) {
      return failure(new NonTrouveError('Population', command.idPopulation))
    }
    if (command.idFonctionnalite) {
      const fonctionnalite = await FonctionnaliteSqlModel.findByPk(
        command.idFonctionnalite
      )
      if (!fonctionnalite) {
        return failure(
          new NonTrouveError('Fonctionnalité', command.idFonctionnalite)
        )
      }
    }

    const existant = await DeploiementSqlModel.findOne({
      where: {
        nature: command.nature,
        idPopulation: command.idPopulation,
        idFonctionnalite: command.idFonctionnalite ?? null
      }
    })
    if (existant) {
      await existant.update({
        dateActivation: command.dateActivation.toJSDate()
      })
      return success({ id: existant.id })
    }

    const deploiement = await DeploiementSqlModel.create({
      nature: command.nature,
      idPopulation: command.idPopulation,
      idFonctionnalite: command.idFonctionnalite ?? null,
      dateActivation: command.dateActivation.toJSDate()
    })
    return success({ id: deploiement.id })
  }
}

function verifierCoherence(
  command: CreerDeploiementCommand
): Result<DeploiementCree> | undefined {
  const estFonctionnalite = command.nature === Deploiement.Nature.FONCTIONNALITE
  if (estFonctionnalite && !command.idFonctionnalite) {
    return failure(
      new MauvaiseCommandeError(
        'Un déploiement de nature FONCTIONNALITE exige idFonctionnalite'
      )
    )
  }
  if (!estFonctionnalite && command.idFonctionnalite) {
    return failure(
      new MauvaiseCommandeError(
        'Un déploiement de nature MIGRATION ne porte pas de fonctionnalité'
      )
    )
  }
  return undefined
}

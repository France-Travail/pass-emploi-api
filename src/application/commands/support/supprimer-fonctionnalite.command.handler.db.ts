import { Injectable } from '@nestjs/common'
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
import { DeploiementSqlModel } from '../../../infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite.sql-model'

export interface SupprimerFonctionnaliteCommand extends Command {
  id: string
}

@Injectable()
export class SupprimerFonctionnaliteCommandHandler extends CommandHandler<
  SupprimerFonctionnaliteCommand,
  void
> {
  constructor() {
    super('SupprimerFonctionnaliteCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Un déploiement qui la vise bloque la suppression, pour ne pas désactiver un drapeau par accident.
  async handle(command: SupprimerFonctionnaliteCommand): Promise<Result> {
    const fonctionnalite = await FonctionnaliteSqlModel.findByPk(command.id)
    if (!fonctionnalite) {
      return failure(new NonTrouveError('Fonctionnalité', command.id))
    }

    const nombreDeDeploiements = await DeploiementSqlModel.count({
      where: { idFonctionnalite: command.id }
    })
    if (nombreDeDeploiements > 0) {
      return failure(
        new MauvaiseCommandeError(
          `La fonctionnalité ${command.id} est visée par ${nombreDeDeploiements} déploiement(s), les supprimer d'abord`
        )
      )
    }

    await fonctionnalite.destroy()
    return emptySuccess()
  }
}

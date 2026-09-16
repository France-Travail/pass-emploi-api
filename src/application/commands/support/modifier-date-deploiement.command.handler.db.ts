import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { DeploiementSqlModel } from '../../../infrastructure/sequelize/models/deploiement.sql-model'

export interface ModifierDateDeploiementCommand extends Command {
  id: number
  dateActivation: DateTime
}

// Seule la date se modifie : changer la population, la nature ou la fonctionnalité, c'est un autre déploiement.
@Injectable()
export class ModifierDateDeploiementCommandHandler extends CommandHandler<
  ModifierDateDeploiementCommand,
  void
> {
  constructor() {
    super('ModifierDateDeploiementCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: ModifierDateDeploiementCommand): Promise<Result> {
    const [nombreDeModifications] = await DeploiementSqlModel.update(
      { dateActivation: command.dateActivation.toJSDate() },
      { where: { id: command.id } }
    )
    if (nombreDeModifications === 0) {
      return failure(new NonTrouveError('Déploiement', String(command.id)))
    }
    return emptySuccess()
  }
}

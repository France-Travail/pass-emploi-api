import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { DeploiementSqlModel } from '../../../infrastructure/sequelize/models/deploiement.sql-model'

export interface SupprimerDeploiementCommand extends Command {
  id: number
}

@Injectable()
export class SupprimerDeploiementCommandHandler extends CommandHandler<
  SupprimerDeploiementCommand,
  void
> {
  constructor() {
    super('SupprimerDeploiementCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: SupprimerDeploiementCommand): Promise<Result> {
    const nombreDeSuppressions = await DeploiementSqlModel.destroy({
      where: { id: command.id }
    })
    if (nombreDeSuppressions === 0) {
      return failure(new NonTrouveError('Déploiement', String(command.id)))
    }
    return emptySuccess()
  }
}

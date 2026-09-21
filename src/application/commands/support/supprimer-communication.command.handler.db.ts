import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'

export interface SupprimerCommunicationCommand extends Command {
  id: number
}

@Injectable()
export class SupprimerCommunicationCommandHandler extends CommandHandler<
  SupprimerCommunicationCommand,
  void
> {
  constructor() {
    super('SupprimerCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: SupprimerCommunicationCommand): Promise<Result> {
    const nombreDeSuppressions = await CommunicationSqlModel.destroy({
      where: { id: command.id }
    })
    if (nombreDeSuppressions === 0) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    return emptySuccess()
  }
}

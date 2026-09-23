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
import { Communication } from '../../../domain/communication'
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
    const existante = await CommunicationSqlModel.findByPk(command.id)
    if (!existante) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    if (!Communication.estModifiable(existante.statutEnvoi)) {
      return failure(
        new MauvaiseCommandeError(
          "Une communication dont l'envoi a démarré ne peut plus être supprimée"
        )
      )
    }
    await existante.destroy()
    return emptySuccess()
  }
}

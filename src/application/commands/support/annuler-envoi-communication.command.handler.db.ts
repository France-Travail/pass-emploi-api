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
  Communication,
  CommunicationRepositoryToken
} from '../../../domain/communication'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'
import { DateService } from '../../../utils/date-service'

export interface AnnulerEnvoiCommunicationCommand extends Command {
  id: number
}

@Injectable()
export class AnnulerEnvoiCommunicationCommandHandler extends CommandHandler<
  AnnulerEnvoiCommunicationCommand,
  void
> {
  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    private readonly dateService: DateService
  ) {
    super('AnnulerEnvoiCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: AnnulerEnvoiCommunicationCommand): Promise<Result> {
    const communication = await CommunicationSqlModel.findByPk(command.id)
    if (!communication) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }
    if (communication.statutEnvoi !== Communication.StatutEnvoi.EN_COURS) {
      return failure(
        new MauvaiseCommandeError('Seul un envoi EN_COURS peut être annulé')
      )
    }
    await this.communicationRepository.terminerEnvoi(
      command.id,
      Communication.StatutEnvoi.ANNULEE,
      this.dateService.now()
    )
    return emptySuccess()
  }
}

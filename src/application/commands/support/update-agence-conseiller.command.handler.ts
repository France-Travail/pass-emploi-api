import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Result, emptySuccess } from '../../../building-blocks/types/result'
import { Agence, ChangementAgenceQueryModel } from '../../../domain/agence'

export interface UpdateAgenceConseillerCommand extends Command {
  idConseiller: string
  idNouvelleAgence: string
}

@Injectable()
export class UpdateAgenceConseillerCommandHandler extends CommandHandler<
  UpdateAgenceConseillerCommand,
  ChangementAgenceQueryModel
> {
  constructor(private readonly agenceService: Agence.Service) {
    super('UpdateAgenceConseillerCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }
  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: UpdateAgenceConseillerCommand
  ): Promise<Result<ChangementAgenceQueryModel>> {
    return this.agenceService.changerAgenceConseiller(
      command.idConseiller,
      command.idNouvelleAgence
    )
  }
}

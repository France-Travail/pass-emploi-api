import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  emptySuccess,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import {
  DesarchivageJeuneQueryModel,
  DesarchivageJeuneService
} from './desarchivage-jeune.service.db'

export interface DesarchiverJeuneCommand extends Command {
  idArchive: number
  emailConseiller: string
}

@Injectable()
export class DesarchiverJeuneCommandHandler extends CommandHandler<
  DesarchiverJeuneCommand,
  DesarchivageJeuneQueryModel
> {
  constructor(private readonly desarchivageService: DesarchivageJeuneService) {
    super('DesarchiverJeuneCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: DesarchiverJeuneCommand
  ): Promise<Result<DesarchivageJeuneQueryModel>> {
    const conseillerResult = await this.desarchivageService.trouverLeConseiller(
      command.emailConseiller
    )
    if (isFailure(conseillerResult)) {
      return conseillerResult
    }
    return this.desarchivageService.desarchiver(
      command.idArchive,
      conseillerResult.data
    )
  }
}

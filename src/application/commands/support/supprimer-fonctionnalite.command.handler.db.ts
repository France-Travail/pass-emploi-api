import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
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

  async handle(command: SupprimerFonctionnaliteCommand): Promise<Result> {
    const nombreDeSuppressions = await FonctionnaliteSqlModel.destroy({
      where: { id: command.id }
    })

    if (nombreDeSuppressions === 0) {
      return failure(new NonTrouveError('Fonctionnalité', command.id))
    }

    return emptySuccess()
  }
}

import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'
import { FonctionnaliteSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite.sql-model'

export interface CreerFonctionnaliteCommand extends Command {
  id: string
}

@Injectable()
export class CreerFonctionnaliteCommandHandler extends CommandHandler<
  CreerFonctionnaliteCommand,
  void
> {
  constructor() {
    super('CreerFonctionnaliteCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: CreerFonctionnaliteCommand): Promise<Result> {
    await FonctionnaliteSqlModel.bulkCreate([{ id: command.id }], {
      ignoreDuplicates: true
    })

    return emptySuccess()
  }
}

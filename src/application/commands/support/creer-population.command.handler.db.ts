import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'
import { PopulationSqlModel } from '../../../infrastructure/sequelize/models/population.sql-model'

export interface CreerPopulationCommand extends Command {
  id: string
  description?: string
}

@Injectable()
export class CreerPopulationCommandHandler extends CommandHandler<
  CreerPopulationCommand,
  void
> {
  constructor() {
    super('CreerPopulationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Rejouer la route met à jour la description sans toucher aux cibles.
  async handle(command: CreerPopulationCommand): Promise<Result> {
    await PopulationSqlModel.upsert({
      id: command.id,
      description: command.description ?? null
    })
    return emptySuccess()
  }
}

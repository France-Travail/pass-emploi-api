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
import { FonctionnaliteConseillerSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite.sql-model'

export interface AjouterConseillersFonctionnaliteCommand extends Command {
  idFonctionnalite: string
  emailConseillers: string[]
  dateActivation?: DateTime
}

@Injectable()
export class AjouterConseillersFonctionnaliteCommandHandler extends CommandHandler<
  AjouterConseillersFonctionnaliteCommand,
  void
> {
  constructor() {
    super('AjouterConseillersFonctionnaliteCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // Rejouer la route sur un conseiller déjà affecté remplace sa date d'activation
  async handle(
    command: AjouterConseillersFonctionnaliteCommand
  ): Promise<Result> {
    const fonctionnalite = await FonctionnaliteSqlModel.findByPk(
      command.idFonctionnalite
    )
    if (!fonctionnalite) {
      return failure(
        new NonTrouveError('Fonctionnalité', command.idFonctionnalite)
      )
    }

    const emailsUniques = Array.from(new Set(command.emailConseillers))
    await FonctionnaliteConseillerSqlModel.bulkCreate(
      emailsUniques.map(emailConseiller => ({
        idFonctionnalite: command.idFonctionnalite,
        emailConseiller,
        dateActivation: command.dateActivation?.toJSDate() ?? null
      })),
      { updateOnDuplicate: ['dateActivation'] }
    )

    return emptySuccess()
  }
}

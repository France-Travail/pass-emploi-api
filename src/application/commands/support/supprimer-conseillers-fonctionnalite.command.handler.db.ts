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
import { FonctionnaliteConseillerSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../infrastructure/sequelize/models/fonctionnalite.sql-model'

export interface SupprimerConseillersFonctionnaliteCommand extends Command {
  idFonctionnalite: string
  emailConseillers?: string[]
  supprimerTousLesConseillers?: boolean
}

@Injectable()
export class SupprimerConseillersFonctionnaliteCommandHandler extends CommandHandler<
  SupprimerConseillersFonctionnaliteCommand,
  void
> {
  constructor() {
    super('SupprimerConseillersFonctionnaliteCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: SupprimerConseillersFonctionnaliteCommand
  ): Promise<Result> {
    const fonctionnalite = await FonctionnaliteSqlModel.findByPk(
      command.idFonctionnalite
    )
    if (!fonctionnalite) {
      return failure(
        new NonTrouveError('Fonctionnalité', command.idFonctionnalite)
      )
    }

    if (command.supprimerTousLesConseillers) {
      await FonctionnaliteConseillerSqlModel.destroy({
        where: { idFonctionnalite: command.idFonctionnalite }
      })
      return emptySuccess()
    }

    if (!command.emailConseillers?.length) {
      return failure(
        new MauvaiseCommandeError(
          'Renseigner emailConseillers ou supprimerTousLesConseillers'
        )
      )
    }

    await FonctionnaliteConseillerSqlModel.destroy({
      where: {
        idFonctionnalite: command.idFonctionnalite,
        emailConseiller: command.emailConseillers
      }
    })

    return emptySuccess()
  }
}

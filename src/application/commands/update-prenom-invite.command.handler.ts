import { Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { JeuneInviteSqlModel } from '../../infrastructure/sequelize/models/jeune-invite.sql-model'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export interface UpdatePrenomInviteCommand extends Command {
  idJeune: string
  prenom: string
}

@Injectable()
export class UpdatePrenomInviteCommandHandler extends CommandHandler<
  UpdatePrenomInviteCommand,
  void
> {
  constructor(private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer) {
    super('UpdatePrenomInviteCommandHandler')
  }

  async handle(command: UpdatePrenomInviteCommand): Promise<Result> {
    const jeuneInvite = await JeuneInviteSqlModel.findByPk(command.idJeune)

    if (!jeuneInvite) {
      return failure(new NonTrouveError('Jeune invité', command.idJeune))
    }

    await jeuneInvite.update({ prenom: command.prenom })

    return emptySuccess()
  }

  async authorize(
    command: UpdatePrenomInviteCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      command.idJeune,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

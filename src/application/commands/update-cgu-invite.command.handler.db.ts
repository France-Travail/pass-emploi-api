import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_INVITE } from '../../domain/profil'
import { JeuneInviteSqlModel } from '../../infrastructure/sequelize/models/jeune-invite.sql-model'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export interface UpdateCGUInviteCommand extends Command {
  idJeune: string
  dateSignatureCGU: string
}

@Injectable()
export class UpdateCGUInviteCommandHandler extends CommandHandler<
  UpdateCGUInviteCommand,
  void
> {
  readonly profilsAutorises = TOUT_INVITE

  constructor(private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer) {
    super('UpdateCGUInviteCommandHandler')
  }

  async handle(command: UpdateCGUInviteCommand): Promise<Result> {
    const [nombreDeLignesMisesAJour] = await JeuneInviteSqlModel.update(
      {
        dateSignatureCGU: DateTime.fromISO(command.dateSignatureCGU).toJSDate()
      },
      { where: { id: command.idJeune } }
    )

    if (nombreDeLignesMisesAJour === 0) {
      return failure(new NonTrouveError('Jeune invité', command.idJeune))
    }

    return emptySuccess()
  }

  async authorize(
    command: UpdateCGUInviteCommand,
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

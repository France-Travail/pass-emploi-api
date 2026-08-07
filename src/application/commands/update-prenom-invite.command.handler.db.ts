import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
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
  readonly profilsAutorises = [Profil.Jeune.INVITE]

  constructor(private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer) {
    super('UpdatePrenomInviteCommandHandler')
  }

  async handle(command: UpdatePrenomInviteCommand): Promise<Result> {
    const [nombreDeLignesMisesAJour] = await JeuneInviteSqlModel.update(
      { prenom: command.prenom },
      { where: { id: command.idJeune } }
    )

    if (nombreDeLignesMisesAJour === 0) {
      return failure(new NonTrouveError('Jeune invité', command.idJeune))
    }

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

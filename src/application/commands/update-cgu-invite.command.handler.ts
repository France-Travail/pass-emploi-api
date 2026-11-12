import { Inject, Injectable } from '@nestjs/common'
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
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../domain/profil'
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

  constructor(
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer
  ) {
    super('UpdateCGUInviteCommandHandler')
  }

  async handle(command: UpdateCGUInviteCommand): Promise<Result> {
    const signe = await this.jeuneInviteRepository.signerCGU(
      command.idJeune,
      DateTime.fromISO(command.dateSignatureCGU)
    )

    if (!signe) {
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

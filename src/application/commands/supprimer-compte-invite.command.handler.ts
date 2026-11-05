import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../domain/profil'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export interface SupprimerCompteInviteCommand extends Command {
  idJeune: string
}

@Injectable()
export class SupprimerCompteInviteCommandHandler extends CommandHandler<
  SupprimerCompteInviteCommand,
  void,
  JeuneInvite.PourSuppression
> {
  readonly profilsAutorises = TOUT_INVITE

  constructor(
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private readonly evenementService: EvenementService
  ) {
    super('SupprimerCompteInviteCommandHandler')
  }

  async getAggregate(
    command: SupprimerCompteInviteCommand
  ): Promise<JeuneInvite.PourSuppression | undefined> {
    return this.jeuneInviteRepository.recupererPourSuppression(command.idJeune)
  }

  async authorize(
    command: SupprimerCompteInviteCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      command.idJeune,
      utilisateur
    )
  }

  async handle(
    command: SupprimerCompteInviteCommand,
    _utilisateur: Authentification.Utilisateur,
    invite?: JeuneInvite.PourSuppression
  ): Promise<Result> {
    if (!invite) {
      return failure(new NonTrouveError('Jeune invité', command.idJeune))
    }
    if (invite.estRepris) {
      return emptySuccess()
    }

    await this.authentificationRepository.supprimerCompteIdp(
      invite.idAuthentification
    )
    await this.jeuneInviteRepository.supprimerPlusieurs([invite.id])

    return emptySuccess()
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    _command: SupprimerCompteInviteCommand,
    invite?: JeuneInvite.PourSuppression
  ): Promise<void> {
    if (!invite || invite.estRepris) return
    await this.evenementService.creer(
      Evenement.Code.COMPTE_SUPPRIME,
      utilisateur
    )
  }
}

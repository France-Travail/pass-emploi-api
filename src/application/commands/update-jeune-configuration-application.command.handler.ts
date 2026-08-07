import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/core'
import {
  Jeune,
  JeuneConfigurationApplicationRepositoryToken
} from '../../domain/jeune/jeune'
import { JeuneInviteConfigurationApplicationRepositoryToken } from '../../domain/jeune/jeune-invite'
import { Profil } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { ConfigurationApplication } from '../../domain/jeune/configuration-application'

export interface UpdateJeuneConfigurationApplicationCommand extends Command {
  idJeune: string
  pushNotificationToken: string
  appVersion?: string
  installationId?: string
  instanceId?: string
  fuseauHoraire?: string
}

@Injectable()
export class UpdateJeuneConfigurationApplicationCommandHandler extends CommandHandler<
  UpdateJeuneConfigurationApplicationCommand,
  void
> {
  readonly profilsAutorises = [
    Profil.Jeune.MILO,
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.CONSEIL_DEPT,
    Profil.Jeune.INVITE
  ]

  constructor(
    @Inject(JeuneConfigurationApplicationRepositoryToken)
    private jeuneConfigurationApplicationRepository: Jeune.ConfigurationApplication.Repository,
    @Inject(JeuneInviteConfigurationApplicationRepositoryToken)
    private jeuneInviteConfigurationApplicationRepository: Jeune.ConfigurationApplication.Repository,
    private jeuneAuthorizer: JeuneAuthorizer,
    private jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private configurationApplicationFactory: ConfigurationApplication.Factory
  ) {
    super('UpdateJeuneConfigurationApplicationCommandHandler')
  }

  async handle(
    command: UpdateJeuneConfigurationApplicationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    const estUnInvite = estInvite(utilisateur.structure)
    const repository = estUnInvite
      ? this.jeuneInviteConfigurationApplicationRepository
      : this.jeuneConfigurationApplicationRepository

    const configurationExistante = await repository.get(command.idJeune)
    if (!configurationExistante) {
      return failure(
        new NonTrouveError(
          command.idJeune,
          estUnInvite ? 'Jeune invité' : 'Jeune'
        )
      )
    }

    const configurationApplication =
      this.configurationApplicationFactory.mettreAJour(
        configurationExistante,
        command
      )
    await repository.save(configurationApplication)
    return emptySuccess()
  }

  async authorize(
    command: UpdateJeuneConfigurationApplicationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (estInvite(utilisateur.structure)) {
      return this.jeuneInviteAuthorizer.autoriserLInvite(
        command.idJeune,
        utilisateur
      )
    }

    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

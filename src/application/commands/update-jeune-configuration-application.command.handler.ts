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
import { JeuneConfigurationApplicationRepositoryToken } from '../../domain/jeune/jeune'
import { JeuneInviteConfigurationApplicationRepositoryToken } from '../../domain/jeune/jeune-invite'
import { estInvite, TOUT_PROFIL } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { ConfigurationApplication } from '../../domain/jeune/configuration-application'

export interface UpdateJeuneConfigurationApplicationCommand extends Command {
  idJeune: string
  pushNotificationToken?: string
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
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    @Inject(JeuneConfigurationApplicationRepositoryToken)
    private readonly jeuneConfigurationApplicationRepository: ConfigurationApplication.Repository,
    @Inject(JeuneInviteConfigurationApplicationRepositoryToken)
    private readonly jeuneInviteConfigurationApplicationRepository: ConfigurationApplication.Repository,
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private readonly configurationApplicationFactory: ConfigurationApplication.Factory
  ) {
    super('UpdateJeuneConfigurationApplicationCommandHandler')
  }

  async handle(
    command: UpdateJeuneConfigurationApplicationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (estInvite(utilisateur.profil.structure)) {
      const configurationExistante =
        await this.jeuneInviteConfigurationApplicationRepository.get(
          command.idJeune
        )
      if (!configurationExistante) {
        return failure(new NonTrouveError(command.idJeune, 'Jeune invité'))
      }

      const configurationApplication =
        this.configurationApplicationFactory.mettreAJour(
          configurationExistante,
          command
        )
      await this.jeuneInviteConfigurationApplicationRepository.save(
        configurationApplication
      )
      return emptySuccess()
    }

    const configurationExistante =
      await this.jeuneConfigurationApplicationRepository.get(command.idJeune)
    if (!configurationExistante) {
      return failure(new NonTrouveError(command.idJeune, 'Jeune'))
    }

    const configurationApplication =
      this.configurationApplicationFactory.mettreAJour(
        configurationExistante,
        command
      )
    await this.jeuneConfigurationApplicationRepository.save(
      configurationApplication
    )
    return emptySuccess()
  }

  async authorize(
    command: UpdateJeuneConfigurationApplicationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (estInvite(utilisateur.profil.structure)) {
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

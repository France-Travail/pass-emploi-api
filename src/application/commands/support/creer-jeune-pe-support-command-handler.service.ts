import { Injectable } from '@nestjs/common'
import {
  CreateJeuneCommand,
  CreerJeunePoleEmploiCommandHandler
} from '../pole-emploi/creer-jeune-pole-emploi.command.handler'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { MauvaiseCommandeError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess,
  Result
} from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Jeune } from '../../../domain/jeune/jeune'
import { Profil } from '../../../domain/profil'
import { rootLogger } from '../../../utils/root-logger'

export interface CreerJeunePESupportCommand extends CreateJeuneCommand {
  motif?: string
}

@Injectable()
export class CreerJeunePESupportCommandHandler extends CommandHandler<
  CreerJeunePESupportCommand,
  Jeune
> {
  readonly profilsAutorises = [Profil.Support.SUPPORT]

  constructor(
    private readonly creerJeunePoleEmploiCommandHandler: CreerJeunePoleEmploiCommandHandler
  ) {
    super('CreerJeuneSupportCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(command: CreerJeunePESupportCommand): Promise<Result<Jeune>> {
    let result: Result<Jeune>
    try {
      result = await this.creerJeunePoleEmploiCommandHandler.handle(command)
    } catch {
      return failure(
        new MauvaiseCommandeError(
          `Le conseiller ${command.idConseiller} n'a pas une structure éligible à la création d'un jeune France Travail`
        )
      )
    }

    if (isSuccess(result)) {
      rootLogger.info(
        {
          labels: {
            action: 'creation_jeune_support',
            id_conseiller: command.idConseiller,
            id_jeune: result.data.id,
            ...(command.motif && { motif: command.motif })
          }
        },
        'creation_jeune_support'
      )
    }

    return result
  }

  async monitor(
    _utilisateur?: Authentification.Utilisateur,
    _command?: CreerJeunePESupportCommand
  ): Promise<void> {
    return
  }
}

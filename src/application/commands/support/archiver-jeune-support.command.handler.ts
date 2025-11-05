import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'
import { ArchiveJeune } from '../../../domain/archive-jeune'
import { Authentification } from '../../../domain/authentification'

import { Jeune } from '../../../domain/jeune/jeune'
import { SupportAuthorizer } from '../../authorizers/support-authorizer'

const COMMENTAIRE_SUPPRESSION_SUPPORT =
  "Pour des raisons techniques nous avons procédé à l'archivage de votre compte."

export interface ArchiverJeuneSupportCommand {
  idJeune: Jeune.Id
}

@Injectable()
export class ArchiverJeuneSupportCommandHandler extends CommandHandler<
  ArchiverJeuneSupportCommand,
  void
> {
  constructor(
    private authorizeSupport: SupportAuthorizer,
    private readonly archiverJeuneService: ArchiveJeune.Service
  ) {
    super('ArchiverJeuneSupportCommandHandler')
  }

  async authorize(
    _command: ArchiverJeuneSupportCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.authorizeSupport.autoriserSupport(utilisateur)
  }

  async handle(command: ArchiverJeuneSupportCommand): Promise<Result> {
    this.archiverJeuneService.archiver(
      command.idJeune,
      COMMENTAIRE_SUPPRESSION_SUPPORT,
      ArchiveJeune.MotifSuppressionSupport.SUPPORT
    )

    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

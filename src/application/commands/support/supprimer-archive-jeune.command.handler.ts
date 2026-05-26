import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import { Authentification } from '../../../domain/authentification'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../../domain/archive-jeune'
import { SupportAuthorizer } from '../../authorizers/support-authorizer'

export interface SupprimerArchiveJeuneCommand extends Command {
  idArchive: number
}

@Injectable()
export class SupprimerArchiveJeuneCommandHandler extends CommandHandler<
  SupprimerArchiveJeuneCommand,
  void
> {
  constructor(
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    private readonly supportAuthorizer: SupportAuthorizer
  ) {
    super('SupprimerArchiveJeuneCommandHandler')
  }

  async handle(command: SupprimerArchiveJeuneCommand): Promise<Result<void>> {
    const existe = await this.archiveJeuneRepository.findById(command.idArchive)
    if (!existe) {
      return failure(
        new NonTrouveError('ArchiveJeune', String(command.idArchive))
      )
    }
    await this.archiveJeuneRepository.delete(command.idArchive)
    return emptySuccess()
  }

  async authorize(
    _command: SupprimerArchiveJeuneCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.supportAuthorizer.autoriserSupport(utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

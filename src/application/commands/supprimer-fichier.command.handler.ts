import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Fichier, FichierRepositoryToken } from '../../domain/fichier'
import { TOUS_LES_PROFILS } from '../../domain/profil'
import { FichierAuthorizer } from '../authorizers/fichier-authorizer'

export interface SupprimerFichierCommand extends Command {
  idFichier: string
}

@Injectable()
export class SupprimerFichierCommandHandler extends CommandHandler<
  SupprimerFichierCommand,
  void
> {
  readonly profilsAutorises = TOUS_LES_PROFILS

  constructor(
    @Inject(FichierRepositoryToken)
    private fichierRepository: Fichier.Repository,
    private fichierAuthorizer: FichierAuthorizer
  ) {
    super('SupprimerFichierCommandHandler')
  }

  async authorize(
    command: SupprimerFichierCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.fichierAuthorizer.autoriserSuppressionDuFichier(
      command.idFichier,
      utilisateur
    )
  }

  async handle(command: SupprimerFichierCommand): Promise<Result<void>> {
    await this.fichierRepository.delete(command.idFichier)
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

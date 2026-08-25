import { Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Authentification } from '../../domain/authentification'
import { Core } from '../../domain/core'
import { Evenement, EvenementService } from '../../domain/evenement'
import { structureLegacyVersProfil, TOUT_PROFIL } from '../../domain/profil'

export interface CreateEvenementCommand extends Command {
  type: Evenement.Code
  emetteur: {
    id: string
    type: Authentification.Type
    structure: Core.Structure
  }
}

@Injectable()
export class CreateEvenementCommandHandler extends CommandHandler<
  CreateEvenementCommand,
  void
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(private evenementService: EvenementService) {
    super('CreateEvenementCommandHandler')
  }
  async handle(): Promise<Result> {
    return emptySuccess()
  }

  async authorize(
    command: CreateEvenementCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    const memeType = command.emetteur.type === utilisateur.type
    const memeStructure =
      structureLegacyVersProfil(command.emetteur.structure).structure ===
      utilisateur.profil.structure
    const memeId = command.emetteur.id === utilisateur.id
    if (memeType && memeStructure && memeId) {
      return emptySuccess()
    }
    return failure(new DroitsInsuffisants())
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: CreateEvenementCommand
  ): Promise<void> {
    await this.evenementService.creer(command.type, utilisateur)
  }
}

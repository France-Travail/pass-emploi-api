import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Result } from '../../../building-blocks/types/result'
import { Agence, ChangementAgenceQueryModel } from '../../../domain/agence'
import { Authentification } from '../../../domain/authentification'

import { SupportAuthorizer } from '../../authorizers/support-authorizer'

export interface UpdateAgenceConseillerCommand extends Command {
  idConseiller: string
  idNouvelleAgence: string
}

@Injectable()
export class UpdateAgenceConseillerCommandHandler extends CommandHandler<
  UpdateAgenceConseillerCommand,
  ChangementAgenceQueryModel
> {
  constructor(
    private readonly agenceService: Agence.Service,
    private readonly supportAuthorizer: SupportAuthorizer
  ) {
    super('UpdateAgenceConseillerCommandHandler')
  }

  async authorize(
    _command: UpdateAgenceConseillerCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.supportAuthorizer.autoriserSupport(utilisateur)
  }
  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: UpdateAgenceConseillerCommand
  ): Promise<Result<ChangementAgenceQueryModel>> {
    return this.agenceService.changerAgenceConseiller(
      command.idConseiller,
      command.idNouvelleAgence
    )
  }
}

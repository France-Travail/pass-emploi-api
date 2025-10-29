import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  isSuccess,
  Result,
  success
} from '../../../building-blocks/types/result'
import {
  Agence,
  AgenceRepositoryToken,
  ChangementAgenceQueryModel
} from '../../../domain/agence'
import { Authentification } from '../../../domain/authentification'

import { SupportAuthorizer } from '../../authorizers/support-authorizer'

export interface FusionnerAgencesCommand extends Command {
  idAgenceSource: string
  idAgenceCible: string
}

@Injectable()
export class FusionnerAgencesCommandHandler extends CommandHandler<
  FusionnerAgencesCommand,
  ChangementAgenceQueryModel[]
> {
  constructor(
    private readonly agenceService: Agence.Service,
    private readonly supportAuthorizer: SupportAuthorizer,
    @Inject(AgenceRepositoryToken)
    private readonly agenceRepository: Agence.Repository
  ) {
    super('FusionnerAgencesCommandHandler')
  }

  async authorize(
    _command: FusionnerAgencesCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.supportAuthorizer.autoriserSupport(utilisateur)
  }
  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: FusionnerAgencesCommand
  ): Promise<Result<ChangementAgenceQueryModel[]>> {
    const queryModels: ChangementAgenceQueryModel[] = []

    const conseillersDeLAgenceSource =
      await this.agenceRepository.findAllConseillersByAgence(
        command.idAgenceSource
      )

    for (const conseiller of conseillersDeLAgenceSource) {
      const result = await this.agenceService.changerAgenceConseiller(
        conseiller.id,
        command.idAgenceCible
      )
      if (isSuccess(result)) {
        queryModels.push(result.data)
      }
    }
    return success(queryModels)
  }
}

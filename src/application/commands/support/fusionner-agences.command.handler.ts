import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  emptySuccess,
  isSuccess,
  Result,
  success
} from '../../../building-blocks/types/result'
import {
  Agence,
  AgenceRepositoryToken,
  ChangementAgenceQueryModel
} from '../../../domain/agence'

import { Profil } from '../../../domain/profil'

export interface FusionnerAgencesCommand extends Command {
  idAgenceSource: string
  idAgenceCible: string
}

@Injectable()
export class FusionnerAgencesCommandHandler extends CommandHandler<
  FusionnerAgencesCommand,
  ChangementAgenceQueryModel[]
> {
  readonly profilsAutorises = [Profil.Support.SUPPORT]

  constructor(
    private readonly agenceService: Agence.Service,
    @Inject(AgenceRepositoryToken)
    private readonly agenceRepository: Agence.Repository
  ) {
    super('FusionnerAgencesCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
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

import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { Profil } from '../../../domain/profil'
import { DateService } from '../../../utils/date-service'

export interface DeconnecterJeunesDispositifCommand {
  dispositif: Profil.Dispositif
}

@Injectable()
export class DeconnecterJeunesDispositifCommandHandler extends CommandHandler<
  DeconnecterJeunesDispositifCommand,
  void
> {
  constructor(
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('DeconnecterJeunesDispositifCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(command: DeconnecterJeunesDispositifCommand): Promise<Result> {
    await this.planificateurRepository.ajouterJob<Planificateur.JobDeconnecterJeunesDispositif>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF,
        contenu: { dispositif: command.dispositif }
      }
    )

    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../domain/planificateur'
import { TOUT_PROFIL } from '../../domain/profil'
import { DateService } from '../../utils/date-service'

export type NotifierNouvellesImmersionsCommand = Command &
  Planificateur.JobNotifierNouvellesImmersions

@Injectable()
export class NotifierNouvellesImmersionsCommandHandler extends CommandHandler<
  NotifierNouvellesImmersionsCommand,
  void
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('NotifierNouvellesImmersionsCommandHandler')
  }

  async handle(command: NotifierNouvellesImmersionsCommand): Promise<Result> {
    await this.planificateurRepository.ajouterJob<Planificateur.JobNotifierNouvellesImmersions>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS,
        contenu: { immersions: command.immersions }
      }
    )

    return emptySuccess()
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

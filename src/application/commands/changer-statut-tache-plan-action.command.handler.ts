import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'

export interface ChangerStatutTachePlanActionCommand extends Command {
  idJeune: string
  idTache: string
  terminee: boolean
}

@Injectable()
export class ChangerStatutTachePlanActionCommandHandler extends CommandHandler<
  ChangerStatutTachePlanActionCommand,
  void
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super('ChangerStatutTachePlanActionCommandHandler')
  }

  async authorize(
    command: ChangerStatutTachePlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(command: ChangerStatutTachePlanActionCommand): Promise<Result> {
    const tache = await this.planActionRepository.getTache(
      command.idJeune,
      command.idTache
    )
    if (!tache) {
      return failure(new NonTrouveError('TachePlanAction', command.idTache))
    }

    const tacheMiseAJour = PlanAction.changerStatutTache(
      tache,
      command.terminee,
      this.dateService.now()
    )
    await this.planActionRepository.saveTache(tacheMiseAJour)

    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

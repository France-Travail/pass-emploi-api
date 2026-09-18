import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { PlanActionConnecteQueryModel } from '../queries/query-models/plan-action.query-model'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { Evenement, EvenementService } from '../../domain/evenement'
import { ConfigService } from '@nestjs/config'
import { Authentification } from '../../domain/authentification'
import { failure, Result, success } from '../../building-blocks/types/result'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import { PlanActionSqlRepository } from '../../infrastructure/repositories/plan-action/plan-action-sql.repository.db'

export interface RecupererPlanActionCommand {
  idJeune: string
}

@Injectable()
export class RecupererPlanActionCommandHandler extends CommandHandler<
  RecupererPlanActionCommand,
  PlanActionConnecteQueryModel
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly planActionSqlRepository: PlanActionSqlRepository,
    private readonly evenementService: EvenementService,
    private readonly configService: ConfigService
  ) {
    super('RecupererPlanActionCommandHandler')
  }

  async authorize(
    command: RecupererPlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: RecupererPlanActionCommand
  ): Promise<Result<PlanActionConnecteQueryModel>> {
    const plan = await this.planActionSqlRepository.getDernierPlan(
      command.idJeune
    )

    if (!plan) {
      return failure(new NonTrouveError('PlanAction', command.idJeune))
    }

    return success(plan)
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.PLAN_ACTION_CONSULTATION,
      utilisateur
    )
  }
}

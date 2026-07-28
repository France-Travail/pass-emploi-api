import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { isSuccess, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/core'
import { Evenement, EvenementService } from '../../domain/evenement'
import { PlanActionClient } from '../../infrastructure/clients/plan-action-client'
import { GenererPlanActionPayload } from '../../infrastructure/routes/validation/plan-action.inputs'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { PlanActionQueryModel } from '../queries/query-models/plan-action.query-model'
import {
  toPlanActionQueryModel,
  toProfileDto
} from './mappers/plan-action.mapper'

export interface GenererPlanActionCommand {
  idJeune: string
  payload: GenererPlanActionPayload
}

@Injectable()
export class GenererPlanActionCommandHandler extends CommandHandler<
  GenererPlanActionCommand,
  PlanActionQueryModel
> {
  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private readonly planActionClient: PlanActionClient,
    private readonly evenementService: EvenementService
  ) {
    super('GenererPlanActionCommandHandler')
  }

  async authorize(
    command: GenererPlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (estInvite(utilisateur.structure)) {
      return this.jeuneInviteAuthorizer.autoriserLInvite(
        command.idJeune,
        utilisateur
      )
    }
    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: GenererPlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result<PlanActionQueryModel>> {
    const profile = toProfileDto(command.payload, utilisateur.structure)
    const result = await this.planActionClient.genererPlan(profile)

    if (isSuccess(result)) {
      return success(toPlanActionQueryModel(result.data))
    }

    return result
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.PLAN_ACTION_GENERE,
      utilisateur
    )
  }
}

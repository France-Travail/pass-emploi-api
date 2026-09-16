import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { PlanAction } from '../../domain/plan-action'
import {
  DISPOSITIFS_ACCOMPAGNES,
  estInvite,
  TOUT_INVITE
} from '../../domain/profil'
import { GenererPlanActionPayload } from '../../infrastructure/routes/validation/plan-action.inputs'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { PlanActionQueryModel } from '../queries/query-models/plan-action.query-model'
import {
  toPlanActionQueryModel,
  toProfilJeune
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
  readonly profilsAutorises = [...DISPOSITIFS_ACCOMPAGNES, TOUT_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private readonly planActionService: PlanAction.Service,
    private readonly evenementService: EvenementService,
    private readonly configService: ConfigService
  ) {
    super('GenererPlanActionCommandHandler')
  }

  async authorize(
    command: GenererPlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    if (estInvite(utilisateur.profil.structure)) {
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
    const profil = toProfilJeune(command.payload, utilisateur.profil.structure)
    const plan = this.planActionService.genererPlan(profil)

    return success(toPlanActionQueryModel(plan))
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.PLAN_ACTION_GENERE,
      utilisateur
    )
  }

  protected labelsDuLog(
    _result: Result<PlanActionQueryModel>,
    command?: GenererPlanActionCommand
  ): Record<string, string | string[]> | undefined {
    if (!command) return undefined

    return {
      plan_action_situation: command.payload.situation,
      plan_action_goals: command.payload.goals,
      ...(command.payload.domaine
        ? { plan_action_domain: command.payload.domaine }
        : {}),
      ...(command.payload.obstacles?.length
        ? { plan_action_obstacles: command.payload.obstacles }
        : {})
    }
  }
}

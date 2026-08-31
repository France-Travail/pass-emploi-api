import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  failure,
  isSuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/core'
import { Evenement, EvenementService } from '../../domain/evenement'
import { PlanAction } from '../../domain/plan-action'
import { Profil } from '../../domain/profil'
import { GenererPlanActionPayload } from '../../infrastructure/routes/validation/plan-action.inputs'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { PlanActionQueryModel } from '../queries/query-models/plan-action.query-model'
import { toPlanActionQueryModel, toProfil } from './mappers/plan-action.mapper'

export interface GenererPlanActionCommand {
  idJeune: string
  payload: GenererPlanActionPayload
}

@Injectable()
export class GenererPlanActionCommandHandler extends CommandHandler<
  GenererPlanActionCommand,
  PlanActionQueryModel
> {
  readonly profilsAutorises = [
    Profil.Jeune.MILO,
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.CONSEIL_DEPT,
    Profil.Jeune.INVITE
  ]

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
    const profil = toProfil(command.payload, utilisateur.structure)

    // La génération ne peut pas échouer : le service retombe sur le plan de
    // secours déterministe quand le générateur LLM est indisponible
    const plan = await this.planActionService.genererPlan(profil)

    return success(toPlanActionQueryModel(plan))
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.PLAN_ACTION_GENERE,
      utilisateur
    )
  }

  protected labelsDuLog(
    result: Result<PlanActionQueryModel>,
    command?: GenererPlanActionCommand
  ): Record<string, string | string[]> | undefined {
    if (!command) return undefined

    const labels: Record<string, string | string[]> = {
      plan_action_situation: command.payload.situation,
      plan_action_goals: command.payload.goals,
      ...(command.payload.domaine
        ? { plan_action_domain: command.payload.domaine }
        : {}),
      ...(command.payload.obstacles?.length
        ? { plan_action_obstacles: command.payload.obstacles }
        : {})
    }
    if (isSuccess(result)) {
      labels.plan_action_generateur = result.data.generateur
    }
    return labels
  }
}

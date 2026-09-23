import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  failure,
  isFailure,
  isSuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import {
  GenerateurDePlanActionToken,
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import {
  DISPOSITIFS_ACCOMPAGNES,
  estInvite,
  Profil,
  TOUT_INVITE
} from '../../domain/profil'
import { GenererPlanActionPayload } from '../../infrastructure/routes/validation/plan-action.inputs'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { toPlanActionQueryModel } from '../queries/query-mappers/plan-action.query-mapper'
import { PlanActionQueryModel } from '../queries/query-models/plan-action.query-model'

export interface GenererPlanActionCommand {
  idJeune: string
  payload: GenererPlanActionPayload
  compteursReferentiel?: {
    idsRecus: number
    idsInconnus: number
  }
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
    @Inject(GenerateurDePlanActionToken)
    private readonly generateur: PlanAction.Generateur,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    private readonly planActionFactory: PlanAction.Factory,
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
    const profil = toProfil(command.payload, utilisateur.profil.structure)

    const suggestion = await this.generateur.genererPlan(profil)
    if (isFailure(suggestion)) return suggestion

    const idsSolutions = suggestion.data.objectifs.flatMap(
      objectif => objectif.idsSolutions
    )
    const solutions =
      await this.referentielRepository.trouverSolutions(idsSolutions)

    const idsConnus = new Set(solutions.map(solution => solution.id))
    command.compteursReferentiel = {
      idsRecus: idsSolutions.length,
      idsInconnus: idsSolutions.filter(id => !idsConnus.has(id)).length
    }

    const plan = this.planActionFactory.creer(
      command.idJeune,
      suggestion.data,
      solutions
    )
    if (isFailure(plan)) return plan

    if (!estInvite(utilisateur.profil.structure)) {
      await this.planActionRepository.save(plan.data)
    }

    return success(
      toPlanActionQueryModel(plan.data, solutions, suggestion.data)
    )
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
        : {}),
      ...(command.compteursReferentiel
        ? {
            plan_action_ids_recus: String(
              command.compteursReferentiel.idsRecus
            ),
            plan_action_ids_inconnus: String(
              command.compteursReferentiel.idsInconnus
            )
          }
        : {})
    }
    if (isSuccess(result)) {
      labels.plan_action_generateur = result.data.generateur
    }
    return labels
  }
}

function toProfil(
  payload: GenererPlanActionPayload,
  structure: Profil.Structure
): PlanAction.Profil {
  // setZone conserve le décalage écrit dans la chaîne, pour que la date
  // civile ne glisse pas d'un jour au passage dans le fuseau du serveur.
  const dateNaissance = payload.dateNaissance
    ? DateTime.fromISO(payload.dateNaissance, { setZone: true })
    : undefined

  return {
    structure,
    situation: payload.situation,
    besoins: payload.goals,
    contraintes: payload.obstacles ?? [],
    ...(dateNaissance?.isValid ? { dateNaissance } : {}),
    ...(payload.domaine ? { domaine: payload.domaine } : {}),
    ...(payload.habitation ? { habitation: payload.habitation } : {}),
    ...(payload.villeRecherche
      ? { villeRecherche: payload.villeRecherche }
      : {}),
    ...(payload.rayonKm !== undefined ? { rayonKm: payload.rayonKm } : {})
  }
}

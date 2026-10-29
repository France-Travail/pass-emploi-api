import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import {
  Transaction,
  TransactionServiceToken
} from '../../building-blocks/transaction'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import { Questionnaire } from '../../domain/plan-action/questionnaire'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { TOUT_PROFIL, estInvite, Profil } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { toPlanActionQueryModel } from '../queries/query-mappers/plan-action.query-mapper'
import { PlanActionQueryModel } from '../queries/query-models/plan-action.query-model'

export interface GenererPlanActionCommand extends Command {
  idJeune: string
  situation: Questionnaire.Situation
  precisionSituation?: string | null
  besoins: Questionnaire.Besoin[]
  contraintes: Questionnaire.Contrainte[]
  dateNaissance?: DateTime
  domaineProfessionnelVise?: string | null
  domaineProfessionnelInconnu: boolean
  communeResidence?: Questionnaire.Commune
  communeRecherche?: Questionnaire.Commune
  rayonKm?: number
}

@Injectable()
export class GenererPlanActionCommandHandler extends CommandHandler<
  GenererPlanActionCommand,
  PlanActionQueryModel
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    private readonly planActionFactory: PlanAction.Factory,
    private readonly evenementService: EvenementService,
    private readonly configService: ConfigService,
    @Inject(TransactionServiceToken)
    private readonly transactionService: Transaction.Service
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
    const questionnaire = toQuestionnaire(command, utilisateur.profil.structure)
    const referentiel =
      await this.referentielRepository.trouverSolutionsActives()

    // L'invité n'a pas de compte : son plan vit dans l'app, pas en base
    const planPersiste = !estInvite(utilisateur.profil.structure)
    const planPrecedent = planPersiste
      ? await this.planActionRepository.getDernierPlan(command.idJeune)
      : undefined

    const plan = this.planActionFactory.creer(
      command.idJeune,
      questionnaire,
      referentiel,
      planPrecedent
    )

    if (planPersiste) {
      await this.transactionService.executer(async () => {
        await this.planActionRepository.save(plan)
        return emptySuccess()
      })
    }

    return success(
      toPlanActionQueryModel(plan, referentiel, utilisateur.profil)
    )
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
      plan_action_situation: command.situation,
      plan_action_goals: command.besoins,
      ...(command.domaineProfessionnelVise
        ? { plan_action_domain: command.domaineProfessionnelVise }
        : {}),
      plan_action_unknown_domain: String(command.domaineProfessionnelInconnu),
      ...(command.contraintes.length
        ? { plan_action_obstacles: command.contraintes }
        : {})
    }
  }
}

function toQuestionnaire(
  command: GenererPlanActionCommand,
  structure: Profil.Structure
): Questionnaire {
  return {
    structure,
    situation: command.situation,
    ...(command.precisionSituation
      ? { precisionSituation: command.precisionSituation }
      : {}),
    besoins: command.besoins,
    contraintes: Questionnaire.calculerContraintes(command.contraintes),
    ...(command.dateNaissance ? { dateNaissance: command.dateNaissance } : {}),
    ...(command.communeResidence
      ? { communeResidence: command.communeResidence }
      : {}),
    ...(command.communeRecherche
      ? { communeRecherche: command.communeRecherche }
      : {}),
    ...(command.domaineProfessionnelVise
      ? { domaineProfessionnelVise: command.domaineProfessionnelVise }
      : {}),
    domaineProfessionnelInconnu: command.domaineProfessionnelInconnu,
    ...(command.rayonKm !== undefined ? { rayonKm: command.rayonKm } : {})
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import {
  Transaction,
  TransactionServiceToken
} from '../../building-blocks/transaction'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  DroitsInsuffisants,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationJetonServiceToken
} from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import {
  Questionnaire,
  QuestionnaireRepositoryToken
} from '../../domain/plan-action/questionnaire'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { TOUT_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export interface ReprendreCompteInviteCommand extends Command {
  idInvite: string
  jetonConnecte: string
  plan?: PlanAction.PlanInvite
  questionnaire?: Questionnaire.Reponses
}

@Injectable()
export class ReprendreCompteInviteCommandHandler extends CommandHandler<
  ReprendreCompteInviteCommand,
  void
> {
  readonly profilsAutorises = [TOUT_INVITE]

  constructor(
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    @Inject(AuthentificationJetonServiceToken)
    private readonly jetonService: Authentification.JetonService,
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    @Inject(QuestionnaireRepositoryToken)
    private readonly questionnaireRepository: Questionnaire.Repository,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    private readonly evenementService: EvenementService,
    private readonly dateService: DateService,
    @Inject(TransactionServiceToken)
    private readonly transactionService: Transaction.Service,
    private readonly configService: ConfigService
  ) {
    super('ReprendreCompteInviteCommandHandler')
  }

  async authorize(
    command: ReprendreCompteInviteCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      command.idInvite,
      utilisateur
    )
  }

  async handle(command: ReprendreCompteInviteCommand): Promise<Result> {
    const jeune = await this.jetonService.jeuneDuJeton(command.jetonConnecte)
    if (!jeune) {
      return failure(
        new MauvaiseCommandeError('Jeton compte connecté invalide')
      )
    }
    if (!(await this.jeuneRepository.existe(jeune.id))) {
      return failure(new NonTrouveError('Jeune', jeune.id))
    }

    const invite = await this.jeuneInviteRepository.recupererPourReprise(
      command.idInvite
    )
    if (!invite || invite.dateReprise) {
      return this.issueSansReprise(command.idInvite, invite !== undefined)
    }

    const reprise = await this.transactionService.executer(() =>
      this.reprendre(invite, jeune, command)
    )

    if (isSuccess(reprise) && !reprise.data) {
      const inviteRelu = await this.jeuneInviteRepository.recupererPourReprise(
        command.idInvite
      )
      return this.issueSansReprise(command.idInvite, inviteRelu !== undefined)
    }

    return emptySuccess()
  }

  async monitor(
    _utilisateur: Authentification.Utilisateur,
    command: ReprendreCompteInviteCommand
  ): Promise<void> {
    const jeune = await this.jetonService.jeuneDuJeton(command.jetonConnecte)
    if (jeune) {
      await this.evenementService.creer(
        Evenement.Code.COMPTE_INVITE_REPRIS,
        jeune
      )
    }
  }

  private async reprendre(
    invite: JeuneInvite.PourReprise,
    jeuneConnecte: Authentification.Utilisateur,
    command: ReprendreCompteInviteCommand
  ): Promise<Result<boolean>> {
    const maintenant = this.dateService.now()
    const marque = await this.jeuneInviteRepository.marquerRepris(
      invite.id,
      maintenant
    )
    if (!marque) return success(false)

    await this.jeuneRepository.enregistrerPremiereUtilisationInvite(
      jeuneConnecte.id,
      invite.dateCreation
    )
    if (command.plan) {
      await this.enregistrerPlan(
        jeuneConnecte,
        command.plan,
        command.questionnaire,
        maintenant
      )
    }
    return success(true)
  }

  private async enregistrerPlan(
    jeuneConnecte: Authentification.Utilisateur,
    planInvite: PlanAction.PlanInvite,
    reponses: Questionnaire.Reponses | undefined,
    maintenant: DateTime
  ): Promise<void> {
    const idJeune = jeuneConnecte.id
    if (await this.planActionRepository.existePourJeune(idJeune)) return

    const idsSolutions = planInvite.objectifs.flatMap(objectif =>
      objectif.taches.map(tache => tache.idSolution)
    )
    const solutionsConnues =
      await this.referentielRepository.trouverSolutions(idsSolutions)
    const plan = PlanAction.depuisPlanInvite(
      idJeune,
      planInvite,
      new Set(solutionsConnues.map(solution => solution.id)),
      maintenant
    )
    if (!plan) return

    if (reponses) {
      await this.questionnaireRepository.save({
        ...reponses,
        contraintes: Questionnaire.calculerContraintes(reponses.contraintes),
        structure: jeuneConnecte.profil.structure,
        idJeune,
        dateCreation: plan.dateCreation
      })
    }
    await this.planActionRepository.save(plan)
  }

  private issueSansReprise(idInvite: string, inviteExiste: boolean): Result {
    if (!inviteExiste) {
      return failure(new NonTrouveError('JeuneInvite', idInvite))
    }
    return emptySuccess()
  }
}

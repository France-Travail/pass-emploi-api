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
  DomainError,
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
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import {
  JeuneInvite,
  JeuneInviteJetonServiceToken,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { toEcsError } from '../../utils/logger.helpers'
import { rootLogger } from '../../utils/root-logger'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'

export interface ReprendreCompteInviteCommand extends Command {
  idJeune: string
  jetonInvite: string
  plan?: PlanAction.PlanInvite
}

const CONTEXT_LOG = 'ReprendreCompteInviteCommandHandler'

@Injectable()
export class ReprendreCompteInviteCommandHandler extends CommandHandler<
  ReprendreCompteInviteCommand,
  void
> {
  readonly profilsAutorises = TOUT_PROFIL_SAUF_INVITE

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(JeuneInviteJetonServiceToken)
    private readonly jetonInviteService: JeuneInvite.JetonService,
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
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
    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: ReprendreCompteInviteCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    const idInvite = await this.jetonInviteService.idInviteDuJeton(
      command.jetonInvite
    )
    if (!idInvite) {
      return this.echec(
        'preuve',
        new MauvaiseCommandeError('Jeton invité invalide')
      )
    }

    const invite =
      await this.jeuneInviteRepository.recupererPourReprise(idInvite)
    if (!invite || invite.dateReprise) {
      return this.issueSansReprise(idInvite, invite !== undefined)
    }

    let reprise: Result<boolean>
    try {
      reprise = await this.transactionService.executer(() =>
        this.reprendre(invite, command)
      )
    } catch (e) {
      this.logEchec('enregistrement', e)
      throw e
    }

    if (isSuccess(reprise) && !reprise.data) {
      // Un appel concurrent a repris (ou la purge a supprimé) l'invité entre
      // la lecture et l'écriture : on relit pour répondre selon son issue
      const inviteRelu =
        await this.jeuneInviteRepository.recupererPourReprise(idInvite)
      return this.issueSansReprise(idInvite, inviteRelu !== undefined)
    }

    // Ici et pas dans monitor : monitor ne distingue pas reprise et rejeu,
    // et un rejeu ne doit pas compter deux fois
    await this.evenementService.creer(
      Evenement.Code.COMPTE_INVITE_REPRIS,
      utilisateur
    )
    this.logSucces('nouvelle')
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  // false : l'invité a été repris ou purgé entre la lecture et l'écriture
  private async reprendre(
    invite: JeuneInvite.PourReprise,
    command: ReprendreCompteInviteCommand
  ): Promise<Result<boolean>> {
    const maintenant = this.dateService.now()
    const marque = await this.jeuneInviteRepository.marquerRepris(
      invite.id,
      maintenant
    )
    if (!marque) return success(false)

    await this.jeuneRepository.enregistrerPremiereUtilisationInvite(
      command.idJeune,
      invite.dateCreation
    )
    if (command.plan) {
      await this.enregistrerPlan(command.idJeune, command.plan, maintenant)
    }
    return success(true)
  }

  private async enregistrerPlan(
    idJeune: string,
    planInvite: PlanAction.PlanInvite,
    maintenant: DateTime
  ): Promise<void> {
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
    if (plan) await this.planActionRepository.save(plan)
  }

  private issueSansReprise(idInvite: string, inviteExiste: boolean): Result {
    if (!inviteExiste) {
      return this.echec(
        'introuvable',
        new NonTrouveError('JeuneInvite', idInvite)
      )
    }
    // Déjà repris : succès sans rien réécrire, pour que l'appel soit rejouable.
    // Inutile de vérifier par qui : seul le détenteur du jeton invité appelle
    this.logSucces('rejeu')
    return emptySuccess()
  }

  private echec(step: string, erreur: DomainError): Result {
    this.logEchec(step, erreur)
    return failure(erreur)
  }

  private logEchec(step: string, erreur: unknown): void {
    rootLogger.warn(
      {
        context: CONTEXT_LOG,
        event: { action: 'invite_account_migrated', outcome: 'failure' },
        labels: { step },
        error: toEcsError(erreur)
      },
      'invite_account_migrated'
    )
  }

  private logSucces(reprise: 'nouvelle' | 'rejeu'): void {
    rootLogger.info(
      {
        context: CONTEXT_LOG,
        event: { action: 'invite_account_migrated', outcome: 'success' },
        labels: { reprise }
      },
      'invite_account_migrated'
    )
  }
}

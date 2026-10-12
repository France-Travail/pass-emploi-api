import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { errors } from 'jose'
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
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
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
import { Questionnaire } from '../../domain/plan-action/questionnaire'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { estInvite, TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JwtService } from '../../infrastructure/auth/jwt.service'
import { profilDuClaim } from '../../infrastructure/auth/oidc.auth-guard'
import { DateService } from '../../utils/date-service'
import { toEcsError } from '../../utils/logger.helpers'
import { rootLogger } from '../../utils/root-logger'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'

export interface ReprendreCompteInviteCommand extends Command {
  idJeune: string
  jetonInvite: string
  plan?: {
    id: string
    objectives: Array<{
      id: string
      titre: string
      theme: string
      actions: Array<{
        id: string
        idSolution: string
        terminee: boolean
      }>
    }>
  }
}

const CONTEXT_LOG = 'ReprendreCompteInviteCommandHandler'

@Injectable()
export class ReprendreCompteInviteCommandHandler extends CommandHandler<
  ReprendreCompteInviteCommand,
  void
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jwtService: JwtService,
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
    const idInvite = await this.idInviteDuJeton(command.jetonInvite)
    if (!idInvite) {
      return this.echec(
        'preuve',
        new MauvaiseCommandeError('Jeton invité invalide')
      )
    }

    const invite =
      await this.jeuneInviteRepository.recupererPourReprise(idInvite)
    if (!invite || invite.dateReprise) {
      return this.issueSansReprise(idInvite, invite)
    }

    let reprisParCetAppel = false
    try {
      await this.transactionService.executer(async () => {
        reprisParCetAppel = await this.jeuneInviteRepository.marquerRepris(
          invite.id,
          this.dateService.now()
        )
        if (!reprisParCetAppel) return emptySuccess()
        await this.jeuneRepository.enregistrerPremiereUtilisationInvite(
          command.idJeune,
          invite.dateCreation
        )
        if (command.plan) {
          const planDomaine = await this.construirePlanDomaine(
            command.idJeune,
            command.plan
          )
          if (planDomaine) {
            await this.planActionRepository.save(planDomaine)
          }
        }
        return emptySuccess()
      })
    } catch (e) {
      this.logEchec('enregistrement', e)
      throw e
    }

    if (!reprisParCetAppel) {
      // Un appel concurrent a repris (ou la purge a supprimé) l'invité entre
      // la lecture et l'écriture : on relit pour répondre selon son issue
      const inviteRelu =
        await this.jeuneInviteRepository.recupererPourReprise(idInvite)
      return this.issueSansReprise(idInvite, inviteRelu)
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

  private issueSansReprise(
    idInvite: string,
    invite: { id: string } | undefined
  ): Result {
    if (!invite) {
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

  async monitor(): Promise<void> {
    return
  }

  // jwtVerify ne contrôle ni iss ni aud : n'importe quel access token de
  // connect passe la signature, d'où le contrôle explicite du profil invité
  private async idInviteDuJeton(jeton: string): Promise<string | undefined> {
    try {
      const payload = await this.jwtService.verifyTokenAndGetJwt(jeton)
      if (!estInvite(profilDuClaim(payload).structure)) return undefined
      return typeof payload.userId === 'string' ? payload.userId : undefined
    } catch (e) {
      // Seul un jeton refusé est une preuve invalide (400) ; une panne de
      // Connect/JWKS doit remonter en 500 pour que l'app réessaie
      if (e instanceof errors.JOSEError && !(e instanceof errors.JWKSTimeout)) {
        return undefined
      }
      throw e
    }
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

  private async construirePlanDomaine(
    idJeune: string,
    planPayload: NonNullable<ReprendreCompteInviteCommand['plan']>
  ): Promise<PlanAction | undefined> {
    const idsRequis = planPayload.objectives.flatMap(objectif =>
      objectif.actions.map(action => action.idSolution)
    )
    const solutionsConnues =
      await this.referentielRepository.trouverSolutions(idsRequis)
    const idsSolutionsValides = new Set(
      solutionsConnues.map(solution => solution.id)
    )

    const maintenant = this.dateService.now()
    const objectifsFiltre = planPayload.objectives
      .map(objectif => {
        const actionsValides = objectif.actions.filter(action =>
          idsSolutionsValides.has(action.idSolution)
        )
        if (actionsValides.length === 0) return undefined

        return {
          id: objectif.id,
          titre: objectif.titre,
          theme: objectif.theme as
            Questionnaire.Besoin | Questionnaire.Contrainte,
          taches: actionsValides.map(action => ({
            id: action.id,
            idSolution: action.idSolution,
            terminee: action.terminee,
            dateCreation: maintenant,
            ...(action.terminee ? { dateTerminee: maintenant } : {})
          }))
        }
      })
      .filter(
        (objectif): objectif is PlanAction.Objectif => objectif !== undefined
      )

    if (objectifsFiltre.length === 0) return undefined

    return {
      id: planPayload.id,
      idJeune,
      dateCreation: maintenant,
      objectifs: objectifsFiltre
    }
  }
}

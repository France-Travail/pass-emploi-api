import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { toPlanActionConnecteQueryModel } from './query-mappers/plan-action.query-mapper'
import { PlanActionConnecteQueryModel } from './query-models/plan-action.query-model'

export interface RecupererPlanActionQuery extends Query {
  idJeune: string
}

@Injectable()
export class RecupererPlanActionQueryHandler extends QueryHandler<
  RecupererPlanActionQuery,
  Result<PlanActionConnecteQueryModel>
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    private readonly evenementService: EvenementService,
    private readonly configService: ConfigService
  ) {
    super('RecupererPlanActionQueryHandler')
  }

  async authorize(
    query: RecupererPlanActionQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async handle(
    query: RecupererPlanActionQuery
  ): Promise<Result<PlanActionConnecteQueryModel>> {
    const plan = await this.planActionRepository.getDernierPlan(query.idJeune)

    if (!plan) {
      return failure(new NonTrouveError('PlanAction', query.idJeune))
    }

    const idsSolutions = plan.objectifs.flatMap(objectif =>
      objectif.taches.map(tache => tache.idSolution)
    )
    const solutions =
      await this.referentielRepository.trouverSolutions(idsSolutions)

    return success(toPlanActionConnecteQueryModel(plan, solutions))
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.PLAN_ACTION_CONSULTATION,
      utilisateur
    )
  }
}

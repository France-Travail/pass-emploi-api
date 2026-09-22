import { Injectable } from '@nestjs/common'
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
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { PlanActionSqlRepository } from '../../infrastructure/repositories/plan-action/plan-action-sql.repository.db'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
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
    private readonly planActionSqlRepository: PlanActionSqlRepository,
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
    const plan = await this.planActionSqlRepository.getDernierPlan(
      query.idJeune
    )

    if (!plan) {
      return failure(new NonTrouveError('PlanAction', query.idJeune))
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

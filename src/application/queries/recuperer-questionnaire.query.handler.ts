import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { toQuestionnaireQueryModel } from './query-mappers/questionnaire.query-mapper'
import { QuestionnaireQueryModel } from './query-models/questionnaire.query-model'

export interface RecupererQuestionnaireQuery extends Query {
  idJeune: string
}

@Injectable()
export class RecupererQuestionnaireQueryHandler extends QueryHandler<
  RecupererQuestionnaireQuery,
  Result<QuestionnaireQueryModel | null>
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    private readonly configService: ConfigService
  ) {
    super('RecupererQuestionnaireQueryHandler')
  }

  async authorize(
    query: RecupererQuestionnaireQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async handle(
    query: RecupererQuestionnaireQuery
  ): Promise<Result<QuestionnaireQueryModel | null>> {
    const questionnaire =
      await this.planActionRepository.getQuestionnaireDuDernierPlan(
        query.idJeune
      )

    return success(
      questionnaire ? toQuestionnaireQueryModel(questionnaire) : null
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

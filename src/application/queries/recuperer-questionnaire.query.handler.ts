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
import {
  Questionnaire,
  QuestionnaireRepositoryToken
} from '../../domain/plan-action/questionnaire'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { QuestionnaireQueryModel } from './query-models/questionnaire.query-model'

export interface RecupererQuestionnaireQuery extends Query {
  idJeune: string
}

@Injectable()
export class RecupererQuestionnaireQueryHandler extends QueryHandler<
  RecupererQuestionnaireQuery,
  Result<QuestionnaireQueryModel>
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(QuestionnaireRepositoryToken)
    private readonly questionnaireRepository: Questionnaire.Repository,
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
  ): Promise<Result<QuestionnaireQueryModel>> {
    const questionnaire = await this.questionnaireRepository.get(query.idJeune)

    if (!questionnaire) {
      return failure(new NonTrouveError('Questionnaire', query.idJeune))
    }

    return success(toQuestionnaireQueryModel(questionnaire))
  }

  async monitor(): Promise<void> {
    return
  }
}

function toQuestionnaireQueryModel(
  questionnaire: Questionnaire.Enregistre
): QuestionnaireQueryModel {
  return {
    situation: questionnaire.situation,
    goals: questionnaire.besoins,
    obstacles: questionnaire.contraintes,
    ...(questionnaire.dateNaissance
      ? { dateNaissance: questionnaire.dateNaissance.toISODate()! }
      : {}),
    ...(questionnaire.communeResidence
      ? { habitation: questionnaire.communeResidence }
      : {}),
    ...(questionnaire.communeRecherche
      ? { villeRecherche: questionnaire.communeRecherche }
      : {}),
    ...(questionnaire.domaineProfessionnelVise
      ? { domaine: questionnaire.domaineProfessionnelVise }
      : {}),
    ...(questionnaire.rayonKm !== undefined
      ? { rayonKm: questionnaire.rayonKm }
      : {})
  }
}

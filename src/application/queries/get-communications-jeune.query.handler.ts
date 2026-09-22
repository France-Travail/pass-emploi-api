import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { CommunicationsJeuneQueryModel } from './query-models/communications.query-model'

export interface GetCommunicationsJeuneQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetCommunicationsJeuneQueryHandler extends QueryHandler<
  GetCommunicationsJeuneQuery,
  Result<CommunicationsJeuneQueryModel>
> {
  readonly profilsAutorises = TOUT_PROFIL_SAUF_INVITE

  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    private readonly dateService: DateService,
    private readonly jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetCommunicationsJeuneQueryHandler')
  }

  async handle(
    query: GetCommunicationsJeuneQuery
  ): Promise<Result<CommunicationsJeuneQueryModel>> {
    const messageInformatif =
      await this.communicationRepository.getMessageInformatifDuJeune(
        query.idJeune,
        this.dateService.now()
      )
    return success(messageInformatif ? { messageInformatif } : {})
  }

  async authorize(
    query: GetCommunicationsJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

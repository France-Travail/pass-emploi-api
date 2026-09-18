import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { DISPOSITIFS_ACCOMPAGNES } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { CommunicationsConseillerQueryModel } from './query-models/communications.query-model'

export interface GetCommunicationsConseillerQuery extends Query {
  idConseiller: string
}

@Injectable()
export class GetCommunicationsConseillerQueryHandler extends QueryHandler<
  GetCommunicationsConseillerQuery,
  Result<CommunicationsConseillerQueryModel>
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    private readonly dateService: DateService,
    private readonly conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('GetCommunicationsConseillerQueryHandler')
  }

  async handle(
    query: GetCommunicationsConseillerQuery
  ): Promise<Result<CommunicationsConseillerQueryModel>> {
    const messageInformatif =
      await this.communicationRepository.getMessageInformatifDuConseiller(
        query.idConseiller,
        this.dateService.now()
      )
    return success(messageInformatif ? { messageInformatif } : {})
  }

  async authorize(
    query: GetCommunicationsConseillerQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      query.idConseiller,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  Fonctionnalite,
  FonctionnaliteRepositoryToken
} from '../../domain/fonctionnalite'
import { DISPOSITIFS_ACCOMPAGNES } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { FonctionnalitesConseillerQueryModel } from './query-models/fonctionnalites.query-model'

export interface GetFonctionnalitesConseillerQuery extends Query {
  idConseiller: string
}

@Injectable()
export class GetFonctionnalitesConseillerQueryHandler extends QueryHandler<
  GetFonctionnalitesConseillerQuery,
  Result<FonctionnalitesConseillerQueryModel>
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(
    @Inject(FonctionnaliteRepositoryToken)
    private readonly fonctionnaliteRepository: Fonctionnalite.Repository,
    private readonly dateService: DateService,
    private readonly conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('GetFonctionnalitesConseillerQueryHandler')
  }

  async handle(
    query: GetFonctionnalitesConseillerQuery
  ): Promise<Result<FonctionnalitesConseillerQueryModel>> {
    const fonctionnalites =
      await this.fonctionnaliteRepository.getIdsFonctionnalitesActivesDuConseiller(
        query.idConseiller,
        this.dateService.now()
      )

    return success({ fonctionnalites })
  }

  async authorize(
    query: GetFonctionnalitesConseillerQuery,
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

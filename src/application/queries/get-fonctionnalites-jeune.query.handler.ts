import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  Fonctionnalite,
  FonctionnaliteRepositoryToken
} from '../../domain/fonctionnalite'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { FonctionnalitesJeuneQueryModel } from './query-models/fonctionnalites.query-model'

export interface GetFonctionnalitesJeuneQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetFonctionnalitesJeuneQueryHandler extends QueryHandler<
  GetFonctionnalitesJeuneQuery,
  Result<FonctionnalitesJeuneQueryModel>
> {
  readonly profilsAutorises = TOUT_PROFIL_SAUF_INVITE

  constructor(
    @Inject(FonctionnaliteRepositoryToken)
    private readonly fonctionnaliteRepository: Fonctionnalite.Repository,
    private readonly dateService: DateService,
    private readonly jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetFonctionnalitesJeuneQueryHandler')
  }

  async handle(
    query: GetFonctionnalitesJeuneQuery
  ): Promise<Result<FonctionnalitesJeuneQueryModel>> {
    const fonctionnalites =
      await this.fonctionnaliteRepository.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
        query.idJeune,
        this.dateService.now()
      )

    return success({ fonctionnalites })
  }

  async authorize(
    query: GetFonctionnalitesJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

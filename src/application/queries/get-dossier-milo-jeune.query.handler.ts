import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Profil, TOUT_MILO } from '../../domain/profil'
import {
  JeuneMilo,
  JeuneMiloRepositoryToken
} from '../../domain/milo/jeune.milo'
import { OidcClient } from '../../infrastructure/clients/oidc-client.db'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { DossierJeuneMiloQueryModel } from './query-models/milo.query-model'

export interface GetDossierMiloJeuneQuery extends Query {
  idDossier: string
  accessToken: string
}

@Injectable()
export class GetDossierMiloJeuneQueryHandler extends QueryHandler<
  GetDossierMiloJeuneQuery,
  Result<DossierJeuneMiloQueryModel>
> {
  readonly profilsAutorises = TOUT_MILO

  constructor(
    @Inject(JeuneMiloRepositoryToken)
    private miloRepository: JeuneMilo.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    private readonly oidcClient: OidcClient
  ) {
    super('GetDossierMiloJeuneQueryHandler')
  }

  async handle(
    query: GetDossierMiloJeuneQuery
  ): Promise<Result<DossierJeuneMiloQueryModel>> {
    const idpToken = await this.oidcClient.exchangeToken(
      query.accessToken,
      Profil.Structure.MILO
    )
    return this.miloRepository.getDossier(query.idDossier, idpToken)
  }
  async authorize(
    _query: GetDossierMiloJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserToutConseiller(utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

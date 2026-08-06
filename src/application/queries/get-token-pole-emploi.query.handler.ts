import { Injectable } from '@nestjs/common'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estFranceTravail } from '../../domain/core'
import { Profil } from '../../domain/profil'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'

export interface GetTokenPoleEmploiQuery extends Query {
  idJeune: string
  accessToken: string
}

@Injectable()
export class GetTokenPoleEmploiQueryHandler extends QueryHandler<
  GetTokenPoleEmploiQuery,
  Result<string>
> {
  // TODO: seul handler de la famille SERVICES_FT resté sur estFranceTravail
  // plutôt que sur la capacité SERVICES_FT (basée sur beneficiaireEstFTConnect) :
  // CONSEIL_DEPT et AVENIR_PRO ont accès aux démarches mais pas au token
  // délégué FT ici. Écart volontaire ou non, arbitrage PO en attente. Si
  // volontaire, en faire une capacité dédiée ; sinon, rejoindre SERVICES_FT.
  // profilsAutorises se limite à FT_DEMANDEUR_EMPLOI(_ACCOMPAGNE) : le filtrage
  // fin (CONSEIL_DEPT/AVENIR_PRO exclus malgré ce profil) passe toujours par
  // estFranceTravail dans authorize(), inchangé.
  readonly profilsAutorises = [
    Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.FT_DEMANDEUR_EMPLOI
  ]

  constructor(
    private oidcClient: OidcClient,
    private jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetTokenPoleEmploiQueryHandler')
  }

  async authorize(
    query: GetTokenPoleEmploiQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(
      query.idJeune,
      utilisateur,
      estFranceTravail(utilisateur.structure)
    )
  }

  async handle(
    query: GetTokenPoleEmploiQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result<string>> {
    const token = await this.oidcClient.exchangeTokenJeune(
      query.accessToken,
      utilisateur.structure
    )
    return success(token)
  }

  async monitor(): Promise<void> {
    return
  }
}

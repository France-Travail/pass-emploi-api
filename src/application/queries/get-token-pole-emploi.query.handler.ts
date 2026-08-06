import { Injectable } from '@nestjs/common'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import { Result, failure, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estFranceTravail } from '../../domain/core'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
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
  // TODO: seul handler de la famille FT resté avec un filtrage résiduel dans
  // authorize() : AVENIR_PRO a accès aux démarches (profil
  // FT_DEMANDEUR_EMPLOI_ACCOMPAGNE) mais pas au token délégué FT ici, et
  // CONSEIL_DEPT n'a jamais été dans ce profil. Écart volontaire ou non,
  // arbitrage PO en attente. Le contrôle vit ici plutôt que dans
  // JeuneAuthorizer car il ne se réduit à aucun `Profil` déclarable.
  readonly profilsAutorises = [
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.FT_DEMANDEUR_EMPLOI
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
    if (!estFranceTravail(utilisateur.structure)) {
      return failure(new DroitsInsuffisants('auth_user_not_found'))
    }
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
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

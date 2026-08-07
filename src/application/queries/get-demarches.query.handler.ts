import { Injectable } from '@nestjs/common'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Cached, Query } from '../../building-blocks/types/query'
import { Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { GetDemarchesQueryGetter } from './query-getters/pole-emploi/get-demarches.query.getter'
import { DemarcheQueryModel } from './query-models/actions.query-model'

export interface GetDemarchesQuery extends Query {
  idJeune: string
  accessToken: string
}

@Injectable()
export class GetDemarchesQueryHandler extends QueryHandler<
  GetDemarchesQuery,
  Result<Cached<DemarcheQueryModel[]>>
> {
  readonly profilsAutorises = [
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.CONSEIL_DEPT
  ]

  constructor(
    private getDemarchesQueryGetter: GetDemarchesQueryGetter,
    private jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetDemarchesQueryHandler')
  }

  async handle(
    query: GetDemarchesQuery
  ): Promise<Result<Cached<DemarcheQueryModel[]>>> {
    return this.getDemarchesQueryGetter.handle({
      ...query,
      tri: GetDemarchesQueryGetter.Tri.parSatutEtDateFin
    })
  }

  async authorize(
    query: GetDemarchesQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

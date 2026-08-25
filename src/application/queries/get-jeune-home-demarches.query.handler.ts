import { Injectable } from '@nestjs/common'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Cached, Query } from '../../building-blocks/types/query'
import { isFailure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  TOUT_CONSEIL_DEPARTEMENTAL,
  DISPOSITIFS_FT_AVEC_DEMARCHES
} from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { GetCampagneQueryGetter } from './query-getters/get-campagne.query.getter.db'
import { GetDemarchesQueryGetter } from './query-getters/pole-emploi/get-demarches.query.getter'
import { JeuneHomeDemarcheQueryModel } from './query-models/home-jeune.query-model'

export interface GetJeuneHomeDemarchesQuery extends Query {
  idJeune: string
  accessToken: string
}

@Injectable()
export class GetJeuneHomeDemarchesQueryHandler extends QueryHandler<
  GetJeuneHomeDemarchesQuery,
  Result<Cached<JeuneHomeDemarcheQueryModel>>
> {
  readonly profilsAutorises = [
    DISPOSITIFS_FT_AVEC_DEMARCHES,
    TOUT_CONSEIL_DEPARTEMENTAL
  ]

  constructor(
    private getActionsJeunePoleEmploiQueryGetter: GetDemarchesQueryGetter,
    private getCampagneQueryGetter: GetCampagneQueryGetter,
    private jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetJeuneHomeDemarchesQueryHandler')
  }

  async handle(
    query: GetJeuneHomeDemarchesQuery
  ): Promise<Result<Cached<JeuneHomeDemarcheQueryModel>>> {
    const [demarches, campagne] = await Promise.all([
      this.getActionsJeunePoleEmploiQueryGetter.handle({
        ...query,
        tri: GetDemarchesQueryGetter.Tri.parSatutEtDateFin
      }),
      this.getCampagneQueryGetter.handle({ idJeune: query.idJeune })
    ])

    if (isFailure(demarches)) {
      return demarches
    }

    const data: Cached<JeuneHomeDemarcheQueryModel> = {
      queryModel: {
        actions: demarches.data.queryModel,
        campagne
      },
      dateDuCache: demarches.data.dateDuCache
    }
    return success(data)
  }

  async authorize(
    query: GetJeuneHomeDemarchesQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

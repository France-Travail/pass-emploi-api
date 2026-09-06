import { Injectable } from '@nestjs/common'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { TOUT_PROFIL } from '../../domain/profil'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import { ResultatRechercheOffresImmersionQueryModelV3 } from './query-models/offres-immersion.query-model'
import { FindAllOffresImmersionQueryGetterV3 } from './query-getters/find-all-offres-immersionV3.query.getter.db'

export interface GetOffresImmersionQueryV3 extends Query {
  rome?: string
  appellationCode?: string
  lat: number
  lon: number
  distance?: number
  currentPage: number
  numberPerPage: number
}

@Injectable()
export class GetOffresImmersionQueryHandlerV3 extends QueryHandler<
  GetOffresImmersionQueryV3,
  Result<ResultatRechercheOffresImmersionQueryModelV3>
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    private readonly findAllOffresImmersionQueryGetterV3: FindAllOffresImmersionQueryGetterV3,
    private readonly evenementService: EvenementService
  ) {
    super('GetOffresImmersionQueryHandler')
  }

  async handle(
    query: GetOffresImmersionQueryV3
  ): Promise<Result<ResultatRechercheOffresImmersionQueryModelV3>> {
    return this.findAllOffresImmersionQueryGetterV3.handle(query)
  }
  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.OFFRE_IMMERSION_RECHERCHEE,
      utilisateur
    )
  }
}

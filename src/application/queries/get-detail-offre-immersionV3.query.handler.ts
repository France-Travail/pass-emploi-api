import { Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { DetailOffreImmersionQueryModelV3 } from './query-models/offres-immersion.query-model'
import {
  emptySuccess,
  isFailure,
  Result,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { TOUS_LES_PROFILS } from '../../domain/profil'
import { toDetailOffreImmersionQueryModelV3 } from '../../infrastructure/repositories/mappers/offres-immersion.mappers'
import { ImmersionClient } from '../../infrastructure/clients/immersion-client'

export interface GetDetailOffreImmersionQueryV3 extends Query {
  siret: string
  appellationCode: string
  locationId: string
}

@Injectable()
export class GetDetailOffreImmersionQueryHandlerV3 extends QueryHandler<
  GetDetailOffreImmersionQueryV3,
  Result<DetailOffreImmersionQueryModelV3>
> {
  readonly profilsAutorises = TOUS_LES_PROFILS

  constructor(
    private readonly immersionClient: ImmersionClient,
    private readonly evenementService: EvenementService
  ) {
    super('GetDetailOffreImmersionQueryHandler')
  }

  async handle(
    query: GetDetailOffreImmersionQueryV3
  ): Promise<Result<DetailOffreImmersionQueryModelV3>> {
    const paramsRechercheOffreImmersion = buildParamsRechercheImmersion(
      query.siret,
      query.appellationCode,
      query.locationId
    )

    const response = await this.immersionClient.getDetailOffreV3(
      paramsRechercheOffreImmersion
    )

    if (isFailure(response)) {
      return response
    }

    return success(toDetailOffreImmersionQueryModelV3(response.data))
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    if (Authentification.estConseiller(utilisateur.type)) {
      await this.evenementService.creer(
        Evenement.Code.OFFRE_IMMERSION_AFFICHEE,
        utilisateur
      )
    }
  }
}

function buildParamsRechercheImmersion(
  siret: string,
  appellationCode: string,
  locationId: string
): string {
  return (
    encodeURIComponent(siret) +
    '/' +
    encodeURIComponent(appellationCode) +
    '/' +
    encodeURIComponent(locationId)
  )
}

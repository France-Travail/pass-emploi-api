import { Injectable } from '@nestjs/common'
import {
  isFailure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { OffreImmersionQueryModel } from '../query-models/offres-immersion.query-model'
import { URLSearchParams } from 'url'
import { toOffreImmersionQueryModel } from '../../../infrastructure/repositories/mappers/offres-immersion.mappers'
import { ImmersionClient } from '../../../infrastructure/clients/immersion-client'
import { GetOffresImmersionQuery } from '../get-offres-immersion.query.handler'
import { Offre } from '../../../domain/offre/offre'

@Injectable()
export class FindAllOffresImmersionQueryGetter {
  constructor(private immersionClient: ImmersionClient) {}

  async handle(
    query: GetOffresImmersionQuery
  ): Promise<Result<OffreImmersionQueryModel[]>> {
    const params = this.queryConstructor(query)

    const offresImmersion = await this.immersionClient.getOffres(params)

    if (isFailure(offresImmersion)) {
      return offresImmersion
    }

    return success(offresImmersion.data.map(toOffreImmersionQueryModel))
  }

  queryConstructor(query: GetOffresImmersionQuery): URLSearchParams {
    const distanceAvecDefault = query.distance
      ? query.distance.toString()
      : Offre.Recherche.DISTANCE_PAR_DEFAUT.toString()

    const params = new URLSearchParams()

    params.append('distanceKm', distanceAvecDefault)
    params.append('longitude', query.lon.toString())
    params.append('latitude', query.lat.toString())
    params.append('rome', query.rome)
    params.append('sortBy', 'date')
    params.append('sortOrder', 'desc')

    return params
  }
}

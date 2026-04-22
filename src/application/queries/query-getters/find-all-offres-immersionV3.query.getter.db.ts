import { Inject, Injectable } from '@nestjs/common'
import {
  isFailure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { ResultatRechercheOffresImmersionQueryModelV3 } from '../query-models/offres-immersion.query-model'
import { URLSearchParams } from 'node:url'
import { toOffreImmersionQueryModelV3 } from '../../../infrastructure/repositories/mappers/offres-immersion.mappers'
import { ImmersionClient } from '../../../infrastructure/clients/immersion-client'
import { GetOffresImmersionQueryV3 } from '../get-offres-immersionV3.query.handler'
import { Offre } from '../../../domain/offre/offre'
import { QueryTypes, Sequelize } from 'sequelize'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'

@Injectable()
export class FindAllOffresImmersionQueryGetterV3 {
  constructor(
    private readonly immersionClient: ImmersionClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async handle(
    query: GetOffresImmersionQueryV3
  ): Promise<Result<ResultatRechercheOffresImmersionQueryModelV3>> {
    const appellationCodes = query.appellationCode
      ? [query.appellationCode]
      : await this.romeToAppellationsCode(query.rome!)

    const result = await this.immersionClient.getOffresV3(
      this.buildParams(query, appellationCodes)
    )

    if (isFailure(result)) return result

    return success({
      offres: result.data.data.map(toOffreImmersionQueryModelV3),
      nombrePages: result.data.pagination.totalPages,
      nombreTotal: result.data.pagination.totalRecords
    })
  }

  buildParams(
    query: GetOffresImmersionQueryV3,
    appellationCodes: string[]
  ): URLSearchParams {
    const distanceAvecDefault = query.distance
      ? query.distance.toString()
      : Offre.Recherche.DISTANCE_PAR_DEFAUT.toString()

    const params = new URLSearchParams()

    params.append('distanceKm', distanceAvecDefault)
    params.append('longitude', query.lon.toString())
    params.append('latitude', query.lat.toString())

    appellationCodes.forEach(appellationCode => {
      params.append('appellationCodes[]', appellationCode)
    })

    params.append('sortBy', 'date')
    params.append('sortOrder', 'desc')
    params.append('currentPage', query.currentPage.toString())
    params.append('numberPerPage', query.numberPerPage.toString())

    return params
  }

  async romeToAppellationsCode(codeRome: string): Promise<string[]> {
    const metiers: Array<{ appellation_code: string }> =
      await this.sequelize.query(
        `SELECT appellation_code
       FROM referentiel_metier_rome
       WHERE code = ?
       AND  appellation_code != ''
       ORDER BY libelle DESC`,
        {
          replacements: [codeRome],
          type: QueryTypes.SELECT
        }
      )

    return metiers.map(m => m.appellation_code)
  }
}

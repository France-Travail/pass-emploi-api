import { Inject, Injectable } from '@nestjs/common'
import {
  isFailure,
  isSuccess,
  Result,
  success
} from '../../../building-blocks/types/result'
import { OffreImmersionQueryModelV3 } from '../query-models/offres-immersion.query-model'
import { URLSearchParams } from 'url'
import { toOffreImmersionQueryModelV3 } from '../../../infrastructure/repositories/mappers/offres-immersion.mappers'
import { ImmersionClient } from '../../../infrastructure/clients/immersion-client'
import { GetOffresImmersionQuery } from '../get-offres-immersion.query.handler'
import { Offre } from '../../../domain/offre/offre'
import { QueryTypes, Sequelize } from 'sequelize'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'

const APPELLATION_CODES_LIMIT = 20

@Injectable()
export class FindAllOffresImmersionQueryGetterV3 {
  constructor(
    private immersionClient: ImmersionClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async handle(
    query: GetOffresImmersionQuery
  ): Promise<Result<OffreImmersionQueryModelV3[]>> {
    const appellationCodeListe = await this.romeToAppellationsCode(query.rome)

    const chunks = this.chunkBy(appellationCodeListe, APPELLATION_CODES_LIMIT)

    const results = await Promise.all(
      chunks.map(chunk => {
        const params = this.buildParams(query, chunk)
        return this.immersionClient.getOffresV3(params)
      })
    )

    const firstFailure = results.find(isFailure)
    if (firstFailure) {
      return firstFailure
    }

    const offres = results
      .filter(isSuccess)
      .flatMap(result => result.data)
      .map(toOffreImmersionQueryModelV3)

    return success(offres)
  }

  buildParams(
    query: GetOffresImmersionQuery,
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

    return params
  }

  chunkBy(list: string[], size: number): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < list.length; i += size) {
      chunks.push(list.slice(i, i + size))
    }
    return chunks
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

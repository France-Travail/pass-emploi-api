import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosError, AxiosResponse } from 'axios'
import * as https from 'https'
import { DateTime } from 'luxon'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import { Result, failure, success } from '../../building-blocks/types/result'
import {
  ResultApi,
  failureApi,
  isSuccessApi,
  successApi
} from '../../building-blocks/types/result-api'
import { Demarche } from '../../domain/demarche'
import { suggestionsPEInMemory } from '../repositories/dto/pole-emploi.in-memory.dto'
import {
  CacheApiPartenaireService,
  StatutResultatCache
} from './cache-api-partenaire.service.db'
import {
  DemarcheDto,
  DocumentPoleEmploiDto,
  PrestationDto,
  RendezVousPoleEmploiDto,
  SuggestionDto,
  ThematiqueDto,
  toEtat
} from './dto/pole-emploi.dto'
import { ExternalApiClient } from './external-api-client'
import { handleAxiosError } from './utils/axios-error-handler'

const ORIGINE = 'INDIVIDU'
const DEMARCHES_URL = 'peconnect-demarches/v1/demarches'

export const PoleEmploiPartenaireClientToken = 'PoleEmploiPartenaireClientToken'

interface PoleEmploiPartenaireClientI {
  getDemarches(
    tokenDuJeune: string,
    idJeune?: string
  ): Promise<ResultApi<DemarcheDto[]>>
  getDemarchesEnCache(idJeune: string): Promise<ResultApi<DemarcheDto[]>>

  getRendezVous(
    tokenDuJeune: string,
    dateDebut: DateTime
  ): Promise<ResultApi<RendezVousPoleEmploiDto[]>>

  getPrestations(
    tokenDuJeune: string,
    dateRechercheRendezVous: DateTime
  ): Promise<ResultApi<PrestationDto[]>>

  getLienVisio(tokenDuJeune: string, idVisio: string): Promise<Result<string>>

  getDocuments(
    tokenDuJeune: string
  ): Promise<Result<DocumentPoleEmploiDto[] | void>>

  updateDemarche(
    demarcheModifiee: Demarche.Modifiee,
    token: string
  ): Promise<Result<DemarcheDto>>

  createDemarche(
    demarche: Demarche.Creee,
    token: string
  ): Promise<Result<DemarcheDto>>

  getSuggestionsRecherches(token: string): Promise<ResultApi<SuggestionDto[]>>
}

@Injectable()
export class PoleEmploiPartenaireClient
  extends ExternalApiClient
  implements PoleEmploiPartenaireClientI
{
  private readonly apiUrl: string
  private logger: Logger

  constructor(
    private configService: ConfigService,
    private readonly cacheApiPartenaire: CacheApiPartenaireService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('PoleEmploiPartenaireClient', externalApiLogger)
    this.logger = new Logger('PoleEmploiPartenaireClient')
    this.apiUrl = this.configService.get('poleEmploi').url
  }

  async getDemarches(
    tokenDuJeune: string,
    idJeune?: string
  ): Promise<ResultApi<DemarcheDto[]>> {
    try {
      const response = await this.getWithCache<DemarcheDto[]>(
        `${DEMARCHES_URL}?range=0-99`,
        tokenDuJeune,
        undefined,
        true,
        idJeune
      )

      if (isSuccessApi(response)) {
        if (!response.data || !response.data.length) return successApi([])
      }

      return response
    } catch (_e) {
      return successApi([])
    }
  }

  async getDemarchesEnCache(
    idJeune: string
  ): Promise<ResultApi<DemarcheDto[]>> {
    const cache = await this.cacheApiPartenaire.recuperer<DemarcheDto[]>(
      appendCacheParam(DEMARCHES_URL, idJeune)
    )
    if (!cache)
      return failureApi(new ErreurHttp('Aucune démarche en cache', 404))

    return successApi(cache.data, cache.date)
  }

  async getRendezVous(
    tokenDuJeune: string,
    dateDebut: DateTime
  ): Promise<ResultApi<RendezVousPoleEmploiDto[]>> {
    const params = new URLSearchParams()
    params.append('dateDebut', dateDebut.toUTC().toISO())

    const response = await this.getWithCache<RendezVousPoleEmploiDto[]>(
      'peconnect-rendezvousagenda/v2/listerendezvous',
      tokenDuJeune,
      params,
      true
    )

    if (isSuccessApi(response)) {
      if (!response.data || !response.data.length) return successApi([])
    }
    return response
  }

  async getPrestations(
    tokenDuJeune: string,
    dateRechercheRendezVous: DateTime
  ): Promise<ResultApi<PrestationDto[]>> {
    const params = new URLSearchParams()
    params.append('dateRecherche', dateRechercheRendezVous.toISODate())

    const response = await this.getWithCache<PrestationDto[]>(
      'peconnect-gerer-prestations/v1/rendez-vous',
      tokenDuJeune,
      params,
      true
    )

    if (isSuccessApi(response)) {
      if (!response.data || !response.data.length) return successApi([])
    }
    return response
  }

  async getLienVisio(
    tokenDuJeune: string,
    idVisio: string
  ): Promise<Result<string>> {
    const reponse = await this.getWithRetry<string>(
      `peconnect-gerer-prestations/v1/lien-visio/rendez-vous/${idVisio}`,
      tokenDuJeune
    )
    return success(reponse.data)
  }

  async getDocuments(
    tokenDuJeune: string
  ): Promise<Result<DocumentPoleEmploiDto[]>> {
    try {
      this.logger.log('Récupération des documents du jeune')
      const result = await this.getWithCache<DocumentPoleEmploiDto[]>(
        'peconnect-telecharger-cv-realisation/v1/piecesjointes',
        tokenDuJeune,
        undefined,
        true
      )
      return success(isSuccessApi(result) && result.data ? result.data : [])
    } catch (e) {
      return handleAxiosError(e, 'La récupération des documents a échoué')
    }
  }

  async updateDemarche(
    demarcheModifiee: Demarche.Modifiee,
    token: string
  ): Promise<Result<DemarcheDto>> {
    try {
      const body = {
        id: demarcheModifiee.id,
        dateModification: demarcheModifiee.dateModification.toUTC().toISO(),
        origineModification: ORIGINE,
        etat: toEtat(demarcheModifiee.statut),
        dateDebut: demarcheModifiee.dateDebut
          ? demarcheModifiee.dateDebut?.toUTC().toISO()
          : undefined,
        dateFin: demarcheModifiee.dateFin?.toUTC().toISO(),
        dateAnnulation: demarcheModifiee.dateAnnulation?.toUTC().toISO()
      }
      const demarcheDto = await this.put<DemarcheDto>(
        `${DEMARCHES_URL}/${demarcheModifiee.id}`,
        token,
        body
      )
      return success(demarcheDto.data)
    } catch (e) {
      if (e.response?.data && e.response?.status) {
        const erreur = new ErreurHttp(
          typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data),
          e.response.status
        )
        return failure(erreur)
      }
      throw e
    }
  }

  async createDemarche(
    demarche: Demarche.Creee,
    token: string
  ): Promise<Result<DemarcheDto>> {
    try {
      const body = {
        origineCreateur: ORIGINE,
        etat: toEtat(demarche.statut),
        dateCreation: demarche.dateCreation.toUTC().toISO(),
        dateFin: demarche.dateFin.toUTC().toISO(),
        pourquoi: demarche.pourquoi,
        quoi: demarche.quoi,
        comment: demarche.comment,
        description: demarche.description,
        promptIa: demarche.promptIa
      }
      const demarcheDto = await this.post<DemarcheDto>(
        DEMARCHES_URL,
        token,
        body
      )
      return success(demarcheDto.data)
    } catch (e) {
      if (e.response?.data && e.response?.status) {
        const erreur = new ErreurHttp(
          typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data),
          e.response.status
        )
        return failure(erreur)
      }
      throw e
    }
  }

  async getSuggestionsRecherches(
    token: string
  ): Promise<ResultApi<SuggestionDto[]>> {
    return this.getWithCache<SuggestionDto[]>(
      'peconnect-metiersrecherches/v1/metiersrecherches',
      token,
      undefined,
      true
    )
  }

  async getCatalogue(token: string): Promise<Result<ThematiqueDto[]>> {
    try {
      const response = await this.get<ThematiqueDto[]>(
        `peconnect-demarches/v1/referentiel/demarches`,
        token
      )
      return success(response.data)
    } catch (e) {
      return handleAxiosError(
        e,
        `La récupération du catalogue de démarche a échoué`
      )
    }
  }

  private async get<T>(
    suffixUrl: string,
    tokenDuJeune: string,
    params?: URLSearchParams
  ): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(`${this.apiUrl}/${suffixUrl}`, {
      params,
      headers: { Authorization: `Bearer ${tokenDuJeune}` },
      httpsAgent:
        this.configService.get('environment') !== 'prod'
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined
    })
  }
  private async getWithRetry<T>(
    suffixUrl: string,
    tokenDuJeune: string,
    params?: URLSearchParams,
    secondesAAttendre?: number
  ): Promise<AxiosResponse<T>> {
    if (secondesAAttendre) {
      await new Promise(resolve =>
        setTimeout(resolve, secondesAAttendre * 1000)
      )
    }

    return this.get<T>(suffixUrl, tokenDuJeune, params)
      .then(res => res)
      .catch(e => {
        const estLePremierRetry = secondesAAttendre === undefined
        if (
          e.response?.status === 429 &&
          estLePremierRetry &&
          e.response?.headers &&
          e.response?.headers['retry-after']
        ) {
          return this.getWithRetry<T>(
            suffixUrl,
            tokenDuJeune,
            params,
            parseInt(e.response?.headers['retry-after'])
          )
        }

        throw e
      })
  }

  private async getWithCache<T>(
    suffixUrl: string,
    tokenDuJeune: string,
    params?: URLSearchParams,
    retry?: boolean,
    cacheParam?: string
  ): Promise<ResultApi<T>> {
    const cacheUrl = appendCacheParam(suffixUrl, cacheParam)

    const resultat = await this.cacheApiPartenaire.executerAvecCache<T>({
      cleCache: cacheUrl,
      appel: async () => {
        const res = retry
          ? await this.getWithRetry<T>(suffixUrl, tokenDuJeune, params)
          : await this.get<T>(suffixUrl, tokenDuJeune, params)
        return res.data
      },
      // Repli cache sur erreur technique (pas de réponse / 5xx) ou 402-499, pas sur 401
      erreurEstRecuperable: erreur => {
        const e = erreur as AxiosError
        return !e.response || e.response.status > 401
      }
    })

    switch (resultat.type) {
      case StatutResultatCache.FRAIS:
        return success(resultat.data)
      case StatutResultatCache.CACHE:
        return successApi(resultat.data, resultat.date)
      case StatutResultatCache.ERREUR: {
        const e = resultat.erreur as AxiosError
        if (e.response) {
          return failureApi(
            new ErreurHttp(
              typeof e.response.data === 'string'
                ? e.response.data
                : JSON.stringify(e.response.data),
              e.response.status
            )
          )
        }
        throw e
      }
    }
  }

  private put<T>(
    suffixUrl: string,
    tokenDuJeune: string,
    body: object
  ): Promise<AxiosResponse<T>> {
    return this.axios.put<T>(`${this.apiUrl}/${suffixUrl}`, body, {
      headers: { Authorization: `Bearer ${tokenDuJeune}` },
      httpsAgent:
        this.configService.get('environment') !== 'prod'
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined
    })
  }

  private post<T>(
    suffixUrl: string,
    tokenDuJeune: string,
    body: object
  ): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(`${this.apiUrl}/${suffixUrl}`, body, {
      headers: {
        Authorization: `Bearer ${tokenDuJeune}`,
        'Content-Type': 'application/json;charset=utf-8'
      },
      httpsAgent:
        this.configService.get('environment') !== 'prod'
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined
    })
  }
}

@Injectable()
export class PoleEmploiPartenaireInMemoryClient extends PoleEmploiPartenaireClient {
  async getSuggestionsRecherches(
    _token: string
  ): Promise<ResultApi<SuggestionDto[]>> {
    return success(suggestionsPEInMemory)
  }
}

function appendCacheParam(path: string, cacheParam?: string): string {
  return path + (cacheParam ? '?cacheParam=' + cacheParam : '')
}

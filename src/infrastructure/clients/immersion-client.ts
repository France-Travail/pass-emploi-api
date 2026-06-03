import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosResponse } from 'axios'
import {
  emptySuccess,
  failure,
  Result,
  success
} from 'src/building-blocks/types/result'
import { URLSearchParams } from 'url'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { ExternalApiClient } from './external-api-client'
import { handleAxiosError } from './utils/axios-error-handler'
import { PartenaireImmersion } from '../repositories/dto/immersion.dto'
import { ErreurHttp } from '../../building-blocks/types/domain-error'

export interface FormulaireImmersionPayloadV3 {
  appellationCode: string
  siret: string
  potentialBeneficiaryFirstName: string
  potentialBeneficiaryLastName: string
  potentialBeneficiaryEmail: string
  locationId: string
  potentialBeneficiaryPhone: string
  datePreferences: string
  contactMode: string
  kind: 'IF'
  immersionObjective: string
  experienceAdditionalInformation?: string
  potentialBeneficiaryResumeLink?: string
}

@Injectable()
export class ImmersionClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly immersionApiKey: string
  private logger: Logger

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('ImmersionClient', externalApiLogger)
    this.apiUrl = configService.get('immersion').url
    this.immersionApiKey = configService.get('immersion').apiKey
    this.logger = new Logger('ImmersionClient')
  }

  async getOffresV3(
    params: URLSearchParams
  ): Promise<Result<PartenaireImmersion.SearchResponseV3>> {
    try {
      const response = await this.get<PartenaireImmersion.SearchResponseV3>(
        'v3/offers',
        params
      )

      return success(response.data)
    } catch (erreur) {
      if (erreur.response?.status === 401)
        return failure(new ErreurHttp('API Key Immersion invalide', 400))

      return handleAxiosError(erreur, 'ERROR API getOffres immersion')
    }
  }

  async getDetailOffreV3(
    params: string
  ): Promise<Result<PartenaireImmersion.DtoV3>> {
    try {
      const response = await this.get<PartenaireImmersion.DtoV3>(
        `v3/offers/${params}`
      )
      return success(response.data)
    } catch (erreur) {
      return handleAxiosError(erreur, 'ERROR API getDetail immersion')
    }
  }

  async envoyerFormulaireImmersionV3(
    params: FormulaireImmersionPayloadV3
  ): Promise<Result> {
    try {
      await this.post('v3/apply-to-offer', params)
      return emptySuccess()
    } catch (erreur) {
      return handleAxiosError(
        erreur,
        `L'envoi du formulaire immersion a échoué`
      )
    }
  }

  private async post<T>(
    suffixUrl: string,
    params: unknown
  ): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(`${this.apiUrl}/${suffixUrl}`, params, {
      headers: { Authorization: this.immersionApiKey }
    })
  }

  async get<T>(
    suffixUrl: string,
    params?: URLSearchParams
  ): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(`${this.apiUrl}/${suffixUrl}`, {
      params,
      headers: { Authorization: this.immersionApiKey }
    })
  }
}

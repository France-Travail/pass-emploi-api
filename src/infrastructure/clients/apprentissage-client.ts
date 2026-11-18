import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Result, success } from '../../building-blocks/types/result'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { CommuneApprentissageDto } from './dto/apprentissage.dto'
import { ExternalApiClient } from './external-api-client'
import { handleAxiosError } from './utils/axios-error-handler'

@Injectable()
export class ApprentissageClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apiKey: string

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('ApprentissageClient', externalApiLogger)
    this.apiUrl = configService.get('apprentissage').url
    this.apiKey = configService.get('apprentissage').apiKey
  }

  async rechercherCommunes(
    codePostal: string
  ): Promise<Result<CommuneApprentissageDto[]>> {
    try {
      const response = await this.axios.get<CommuneApprentissageDto[]>(
        `${this.apiUrl}/geographie/v1/commune/search`,
        {
          params: { code: codePostal },
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      )
      return success(response.data)
    } catch (e) {
      return handleAxiosError(
        e,
        'La recherche de communes Apprentissage a échoué'
      )
    }
  }
}

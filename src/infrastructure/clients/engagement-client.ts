import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosResponse } from 'axios'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { ExternalApiClient } from './external-api-client'

@Injectable()
export class EngagementClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apiKey: string

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('ServiceCiviqueClient', externalApiLogger)
    this.apiUrl = configService.get('serviceCivique').url
    this.apiKey = configService.get('serviceCivique').apiKey
  }

  async get<T>(
    suffixUrl: string,
    params?: URLSearchParams
  ): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(`${this.apiUrl}/${suffixUrl}`, {
      headers: { apikey: this.apiKey },
      params
    })
  }
}

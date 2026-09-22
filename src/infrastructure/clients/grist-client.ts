import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import {
  GristRecordDto,
  GristRecordsDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from './dto/grist.dto'
import { ExternalApiClient } from './external-api-client'

const GRIST_ECHEC = 'La lecture du référentiel Grist a échoué'

@Injectable()
export class GristClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apiKey: string
  private readonly docId: string
  private readonly tableServices: string
  private readonly tableSolutions: string
  private readonly timeoutMs: number

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('GristClient', externalApiLogger)
    const config = configService.get('grist')
    this.apiUrl = config.url
    this.apiKey = config.apiKey
    this.docId = config.docId
    this.tableServices = config.tableServices
    this.tableSolutions = config.tableSolutions
    this.timeoutMs = config.timeoutMs
  }

  async recupererServices(): Promise<
    Result<Array<GristRecordDto<GristServiceFieldsDto>>>
  > {
    return this.recupererTable<GristServiceFieldsDto>(this.tableServices)
  }

  async recupererSolutions(): Promise<
    Result<Array<GristRecordDto<GristSolutionFieldsDto>>>
  > {
    return this.recupererTable<GristSolutionFieldsDto>(this.tableSolutions)
  }

  private async recupererTable<T>(
    table: string
  ): Promise<Result<Array<GristRecordDto<T>>>> {
    try {
      const response = await this.axios.get<GristRecordsDto<T>>(
        `${this.apiUrl}/api/docs/${this.docId}/tables/${table}/records`,
        {
          timeout: this.timeoutMs,
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      )

      if (!Array.isArray(response.data?.records)) {
        return failure(new ErreurHttp(GRIST_ECHEC, 502))
      }

      return success(response.data.records)
    } catch (_e) {
      return failure(new ErreurHttp(GRIST_ECHEC, 502))
    }
  }
}

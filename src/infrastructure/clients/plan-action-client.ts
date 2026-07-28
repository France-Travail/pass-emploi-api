import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosError } from 'axios'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { ExternalApiClient } from './external-api-client'
import {
  GenererPlanActionRequestDto,
  GenererPlanActionResponseDto,
  PlanDto,
  ProfileDto
} from './dto/plan-action.dto'

@Injectable()
export class PlanActionClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly modele?: string

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('PlanActionClient', externalApiLogger)
    const configPlanAction = configService.get('planAction')
    this.apiUrl = configPlanAction.url
    this.apiKey = configPlanAction.apiKey
    this.timeoutMs = configPlanAction.timeoutMs
    this.modele = configPlanAction.modele
  }

  async genererPlan(profile: ProfileDto): Promise<Result<PlanDto>> {
    try {
      const body: GenererPlanActionRequestDto = {
        profile,
        ...(this.modele ? { model: this.modele } : {})
      }

      const response = await this.axios.post<GenererPlanActionResponseDto>(
        `${this.apiUrl}/v1/action-plans`,
        body,
        {
          timeout: this.timeoutMs,
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      )

      return success(response.data.plan)
    } catch (e) {
      return handlePlanActionError(e)
    }
  }
}

// Un 400 du service de génération signale un profil que le proxy a mal
// traduit : c'est un défaut interne à l'API, jamais une faute du mobile. On
// ne relaie donc aucun statut du service — contrairement à handleAxiosError,
// utilisé par les autres clients partenaires — et on retombe systématiquement
// sur 502/504 côté mobile.
function handlePlanActionError(error: AxiosError): Result<PlanDto> {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return failure(
      new ErreurHttp(
        "Le service de génération du plan d'action n'a pas répondu à temps",
        504
      )
    )
  }

  return failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
}

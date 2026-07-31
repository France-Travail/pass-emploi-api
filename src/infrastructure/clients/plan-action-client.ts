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

      const plan = response.data?.plan
      if (
        !plan ||
        !Array.isArray(plan.objectives) ||
        plan.objectives.some(objective => !Array.isArray(objective.actions))
      ) {
        return failure(new ErreurHttp(PLAN_ACTION_ECHEC, 502))
      }

      return success(plan)
    } catch (e) {
      return handlePlanActionError(e)
    }
  }
}

const PLAN_ACTION_ECHEC = "La génération du plan d'action a échoué"

function handlePlanActionError(error: AxiosError): Result<PlanDto> {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return failure(
      new ErreurHttp(
        "Le service de génération du plan d'action n'a pas répondu à temps",
        504
      )
    )
  }

  return failure(new ErreurHttp(PLAN_ACTION_ECHEC, 502))
}

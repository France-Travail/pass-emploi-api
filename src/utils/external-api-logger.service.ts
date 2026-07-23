import { Injectable } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { attachExternalApiLogger } from './external-api-logger.helpers'
import { rootLogger } from './root-logger'

// Re-export pour préserver l'API publique historique (utilisé en tests).
export { attachExternalApiLogger } from './external-api-logger.helpers'

export const TIMEOUT_APPEL_SORTANT_MS = 5000

@Injectable()
export class ExternalApiLoggerService {
  /**
   * Crée une instance Axios dédiée, déjà instrumentée pour émettre un log ECS
   * par appel sortant sous le nom `target`. À utiliser via ExternalApiClient.
   */
  createAxios(
    target: string,
    timeoutMs: number = TIMEOUT_APPEL_SORTANT_MS
  ): AxiosInstance {
    const instance = axios.create({ timeout: timeoutMs })
    attachExternalApiLogger(
      instance,
      (level, obj, msg) => {
        rootLogger[level]({ ...obj, context: target }, msg)
      },
      () => rootLogger.isLevelEnabled('debug')
    )
    return instance
  }
}

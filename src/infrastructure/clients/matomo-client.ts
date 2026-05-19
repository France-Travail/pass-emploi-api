import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { RateLimiterService } from '../../utils/rate-limiter.service'
import { getAPMInstance } from '../monitoring/apm.init'
import { NotificationRepository } from '../repositories/notification-firebase.repository.db'
import { ExternalApiClient } from './external-api-client'

@Injectable()
export class MatomoClient extends ExternalApiClient {
  private readonly url: string
  private readonly siteId: string
  private readonly isActive: boolean
  private apmService: APM.Agent

  constructor(
    configService: ConfigService,
    private rateLimiterService: RateLimiterService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('MatomoClient', externalApiLogger)
    this.apmService = getAPMInstance()
    this.url = configService.get('matomo').url
    this.siteId = configService.get('matomo').siteId
    this.isActive = configService.get('features').envoyerStatsMatomo
  }

  async trackEventPushNotificationEnvoyee(
    message: NotificationRepository
  ): Promise<void> {
    if (this.isActive) {
      const categorieEvent = 'Push notifications sur mobile'
      const actionEvent = 'Envoi push notification'
      const nomEvent = message.data.type

      await this.rateLimiterService.matomoRateLimiter.attendreLaProchaineDisponibilite()
      try {
        await this.axios.post(this.url, null, {
          params: {
            idsite: this.siteId,
            rec: 1,
            e_c: categorieEvent,
            e_a: actionEvent,
            e_n: nomEvent
          }
        })
      } catch (e) {
        this.apmService.captureError(e)
      }
    }
  }
}

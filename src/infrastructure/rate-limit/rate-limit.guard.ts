import { ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage
} from '@nestjs/throttler'
import { Authentification } from '../../domain/authentification'
import { toEcsUser } from '../../utils/logger.helpers'
import { rootLogger, toEcsError } from '../../utils/logger.module'
import { RateLimitConfig } from './rate-limit.config'
import { RATE_LIMIT_CONFIG } from './rate-limit.module'
import {
  ipDuClient,
  NomThrottler,
  nomDuThrottler
} from './rate-limit.throttlers'

export interface RequeteRefuseeParLeRateLimit {
  refuseeParLeRateLimit?: boolean
}

const INTERVALLE_LOG_ECHEC_MS = 60000

export function estUnPalierDeRefus(refus: number): boolean {
  if (!Number.isInteger(refus) || refus < 1) {
    return false
  }
  let palier = 1
  while (palier < refus) {
    palier *= 10
  }
  return palier === refus
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private dernierEchecLogue = 0

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(RATE_LIMIT_CONFIG)
    private readonly rateLimitConfig: RateLimitConfig | undefined
  ) {
    super(options, storageService, reflector)
  }

  async onModuleInit(): Promise<void> {
    if (this.rateLimitConfig) {
      await super.onModuleInit()
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context)
    } catch (erreur) {
      if (erreur instanceof ThrottlerException) {
        throw erreur
      }
      this.loguerEchec(erreur)
      return true
    }
  }

  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return !this.rateLimitConfig
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    const { req, res } = this.getRequestResponse(context)
    const utilisateur: Authentification.Utilisateur | undefined =
      req.authenticated?.utilisateur
    const nomThrottler = nomDuThrottler(detail.key)
    const refus = detail.totalHits - detail.limit

    if (estUnPalierDeRefus(refus)) {
      rootLogger.info(
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: {
            rate_limit: nomThrottler,
            rate_limit_palier: String(refus)
          },
          url: { path: req.path },
          http: { request: { id: req.id } },
          ...(utilisateur && { user: toEcsUser(utilisateur) }),
          ...(nomThrottler === NomThrottler.IP && {
            client: { ip: ipDuClient(context) }
          })
        },
        'rate_limit_exceeded'
      )
    }

    const requeteRefusee: RequeteRefuseeParLeRateLimit = req
    requeteRefusee.refuseeParLeRateLimit = true
    this.setResponseHeader(res, 'Retry-After', detail.timeToBlockExpire)
    throw new ThrottlerException()
  }

  private loguerEchec(erreur: unknown): void {
    const maintenant = Date.now()
    if (maintenant - this.dernierEchecLogue < INTERVALLE_LOG_ECHEC_MS) {
      return
    }
    this.dernierEchecLogue = maintenant
    rootLogger.error(
      {
        context: 'RateLimitGuard',
        event: { action: 'rate_limit_guard_failed', outcome: 'failure' },
        error: toEcsError(erreur)
      },
      'rate_limit_guard_failed'
    )
  }
}

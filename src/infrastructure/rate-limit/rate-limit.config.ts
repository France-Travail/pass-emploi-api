import { ConfigService } from '@nestjs/config'
import { rootLogger } from '../../utils/root-logger'

export interface RateLimitConfig {
  utilisateur: {
    fenetreMs: number
    limites: Record<'JEUNE' | 'INVITE' | 'CONSEILLER' | 'SUPPORT', number>
  }
  ip: { fenetreMs: number; limite: number }
  routeCouteuse: { fenetreMs: number; limite: number }
}

export function lireRateLimitConfig(
  configService: ConfigService
): RateLimitConfig | undefined {
  const rateLimitConfig = configService.get('rateLimit')

  if (!rateLimitConfig?.actif) {
    return undefined
  }

  const utilisateurFenetreSecondes =
    rateLimitConfig.utilisateur?.fenetreSecondes
  const limiteJeune = rateLimitConfig.utilisateur?.limites?.JEUNE
  const limiteInvite = rateLimitConfig.utilisateur?.limites?.INVITE
  const limiteConseiller = rateLimitConfig.utilisateur?.limites?.CONSEILLER
  const limiteSupport = rateLimitConfig.utilisateur?.limites?.SUPPORT
  const ipFenetreSecondes = rateLimitConfig.ip?.fenetreSecondes
  const ipLimite = rateLimitConfig.ip?.limite
  const routeCouteuseFenetreSecondes =
    rateLimitConfig.routeCouteuse?.fenetreSecondes
  const routeCouteuseLimite = rateLimitConfig.routeCouteuse?.limite

  if (
    !utilisateurFenetreSecondes ||
    !limiteJeune ||
    !limiteInvite ||
    !limiteConseiller ||
    !limiteSupport ||
    !ipFenetreSecondes ||
    !ipLimite ||
    !routeCouteuseFenetreSecondes ||
    !routeCouteuseLimite
  ) {
    rootLogger.error(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_config_invalide', outcome: 'failure' }
      },
      'rate_limit_config_invalide'
    )
    return undefined
  }

  return {
    utilisateur: {
      fenetreMs: utilisateurFenetreSecondes * 1000,
      limites: {
        JEUNE: limiteJeune,
        INVITE: limiteInvite,
        CONSEILLER: limiteConseiller,
        SUPPORT: limiteSupport
      }
    },
    ip: {
      fenetreMs: ipFenetreSecondes * 1000,
      limite: ipLimite
    },
    routeCouteuse: {
      fenetreMs: routeCouteuseFenetreSecondes * 1000,
      limite: routeCouteuseLimite
    }
  }
}

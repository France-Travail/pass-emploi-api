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

  const variables = {
    RATE_LIMIT_UTILISATEUR_FENETRE_SECONDES:
      rateLimitConfig.utilisateur?.fenetreSecondes,
    RATE_LIMIT_UTILISATEUR_LIMITE_JEUNE:
      rateLimitConfig.utilisateur?.limites?.JEUNE,
    RATE_LIMIT_UTILISATEUR_LIMITE_INVITE:
      rateLimitConfig.utilisateur?.limites?.INVITE,
    RATE_LIMIT_UTILISATEUR_LIMITE_CONSEILLER:
      rateLimitConfig.utilisateur?.limites?.CONSEILLER,
    RATE_LIMIT_UTILISATEUR_LIMITE_SUPPORT:
      rateLimitConfig.utilisateur?.limites?.SUPPORT,
    RATE_LIMIT_IP_FENETRE_SECONDES: rateLimitConfig.ip?.fenetreSecondes,
    RATE_LIMIT_IP_LIMITE: rateLimitConfig.ip?.limite,
    RATE_LIMIT_ROUTE_COUTEUSE_FENETRE_SECONDES:
      rateLimitConfig.routeCouteuse?.fenetreSecondes,
    RATE_LIMIT_ROUTE_COUTEUSE_LIMITE: rateLimitConfig.routeCouteuse?.limite
  }
  const variablesInvalides = Object.entries(variables)
    .filter(([_nom, valeur]) => !valeur)
    .map(([nom]) => nom)

  if (variablesInvalides.length > 0) {
    rootLogger.error(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_config_invalide', outcome: 'failure' },
        labels: { rate_limit_variables_invalides: variablesInvalides.join(',') }
      },
      'rate_limit_config_invalide'
    )
    return undefined
  }

  rootLogger.info(
    {
      context: 'RateLimitConfig',
      event: { action: 'rate_limit_activated', outcome: 'success' },
      labels: {
        rate_limit_seuils: Object.entries(variables)
          .map(([nom, valeur]) => `${nom}=${valeur}`)
          .join(',')
      }
    },
    'rate_limit_activated'
  )

  return {
    utilisateur: {
      fenetreMs: variables.RATE_LIMIT_UTILISATEUR_FENETRE_SECONDES * 1000,
      limites: {
        JEUNE: variables.RATE_LIMIT_UTILISATEUR_LIMITE_JEUNE,
        INVITE: variables.RATE_LIMIT_UTILISATEUR_LIMITE_INVITE,
        CONSEILLER: variables.RATE_LIMIT_UTILISATEUR_LIMITE_CONSEILLER,
        SUPPORT: variables.RATE_LIMIT_UTILISATEUR_LIMITE_SUPPORT
      }
    },
    ip: {
      fenetreMs: variables.RATE_LIMIT_IP_FENETRE_SECONDES * 1000,
      limite: variables.RATE_LIMIT_IP_LIMITE
    },
    routeCouteuse: {
      fenetreMs: variables.RATE_LIMIT_ROUTE_COUTEUSE_FENETRE_SECONDES * 1000,
      limite: variables.RATE_LIMIT_ROUTE_COUTEUSE_LIMITE
    }
  }
}

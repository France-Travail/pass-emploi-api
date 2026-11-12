import { ExecutionContext } from '@nestjs/common'
import { ThrottlerOptions } from '@nestjs/throttler'
import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ROUTE_COUTEUSE_KEY } from '../decorators/route-couteuse.decorator'
import { RateLimitConfig } from './rate-limit.config'

export enum NomThrottler {
  UTILISATEUR = 'utilisateur',
  IP = 'ip',
  ROUTE_COUTEUSE = 'route-couteuse'
}

const PREFIXE_CLE = 'rate-limit'

export function creerThrottlers(config: RateLimitConfig): ThrottlerOptions[] {
  return [
    {
      name: NomThrottler.UTILISATEUR,
      ttl: config.utilisateur.fenetreMs,
      limit: (context): number => limiteUtilisateur(config, context)!,
      skipIf: (context): boolean =>
        limiteUtilisateur(config, context) === undefined,
      getTracker: (_req, context): string => utilisateurDe(context)!.id,
      generateKey: (_context, tracker, nom): string =>
        `${PREFIXE_CLE}:${nom}:${tracker}`
    },
    {
      name: NomThrottler.IP,
      ttl: config.ip.fenetreMs,
      limit: config.ip.limite,
      skipIf: (context): boolean => !estPublique(context),
      getTracker: (req): string =>
        req.headers['x-real-ip'] ?? req.socket.remoteAddress,
      generateKey: (_context, tracker, nom): string =>
        `${PREFIXE_CLE}:${nom}:${tracker}`
    },
    {
      name: NomThrottler.ROUTE_COUTEUSE,
      ttl: config.routeCouteuse.fenetreMs,
      limit: config.routeCouteuse.limite,
      skipIf: (context): boolean =>
        !estRouteCouteuse(context) || !utilisateurDe(context),
      getTracker: (_req, context): string => utilisateurDe(context)!.id,
      generateKey: (context, tracker, nom): string =>
        `${PREFIXE_CLE}:${nom}:${context.getClass().name}.${context.getHandler().name}:${tracker}`
    }
  ]
}

export function nomDuThrottler(cle: string): string {
  return cle.split(':')[1]
}

function utilisateurDe(
  context: ExecutionContext
): Authentification.Utilisateur | undefined {
  return context.switchToHttp().getRequest().authenticated?.utilisateur
}

function limiteUtilisateur(
  config: RateLimitConfig,
  context: ExecutionContext
): number | undefined {
  const utilisateur = utilisateurDe(context)
  if (!utilisateur) {
    return undefined
  }
  if (utilisateur.profil.structure === Profil.Structure.INVITE) {
    return config.utilisateur.limites.INVITE
  }
  const limitesParType: Partial<Record<string, number>> =
    config.utilisateur.limites
  return limitesParType[utilisateur.type]
}

function estPublique(context: ExecutionContext): boolean {
  return Boolean(
    Reflect.getMetadata(IS_PUBLIC_KEY, context.getHandler()) ??
    Reflect.getMetadata(IS_PUBLIC_KEY, context.getClass())
  )
}

function estRouteCouteuse(context: ExecutionContext): boolean {
  return Reflect.getMetadata(ROUTE_COUTEUSE_KEY, context.getHandler()) === true
}

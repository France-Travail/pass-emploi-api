import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Parcours, USER_JOURNEY_METADATA } from './user-journey.decorator'

export interface RequeteJournalisee {
  userJourney?: Parcours
  httpRoute?: string
}

type RequeteExpress = RequeteJournalisee & { route?: { path: string } }

@Injectable()
export class RequeteJournaliseeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requete = context.switchToHttp().getRequest<RequeteExpress>()
    requete.userJourney = this.reflector.getAllAndOverride<
      Parcours | undefined
    >(USER_JOURNEY_METADATA, [context.getHandler(), context.getClass()])
    // Lu ici et non au moment du log : Express garde dans req.route la
    // dernière route traversée, middlewares Nest compris. Une URL inconnue y
    // laisserait le chemin attrape-tout d'un middleware (/{*path}).
    requete.httpRoute = requete.route?.path
    return true
  }
}

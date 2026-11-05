import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { USER_JOURNEY_METADATA } from './user-journey.decorator'

export interface RequeteAvecUserJourney {
  userJourney?: string
}

@Injectable()
export class UserJourneyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requete = context.switchToHttp().getRequest<RequeteAvecUserJourney>()
    requete.userJourney = this.reflector.getAllAndOverride<string | undefined>(
      USER_JOURNEY_METADATA,
      [context.getHandler(), context.getClass()]
    )
    return true
  }
}

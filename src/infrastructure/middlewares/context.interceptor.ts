import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { Context, ContextKey } from '../../building-blocks/context'
import { USER_JOURNEY_METADATA } from '../monitoring/user-journey.decorator'

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(
    private readonly context: Context,
    private readonly reflector: Reflector
  ) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    this.context.start()

    const request = executionContext.switchToHttp().getRequest()

    // Récupération de l'utilisateur avant l'appel de la route. cf: https://docs.nestjs.com/interceptors#interceptors
    this.context.set(ContextKey.UTILISATEUR, request.authenticated?.utilisateur)
    this.context.set(ContextKey.HTTP_REQUEST_ID, request.id)

    const userJourney = this.reflector.get<string | undefined>(
      USER_JOURNEY_METADATA,
      executionContext.getHandler()
    )
    if (userJourney) {
      this.context.set(ContextKey.USER_JOURNEY, userJourney)
    }

    return next.handle().pipe()
  }
}

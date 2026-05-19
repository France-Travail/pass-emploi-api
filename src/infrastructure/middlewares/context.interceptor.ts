import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { Context, ContextKey } from '../../building-blocks/context'

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly context: Context) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    this.context.start()

    const request = executionContext.switchToHttp().getRequest()

    // Récupération de l'utilisateur avant l'appel de la route. cf: https://docs.nestjs.com/interceptors#interceptors
    this.context.set(ContextKey.UTILISATEUR, request.authenticated?.utilisateur)
    this.context.set(ContextKey.HTTP_REQUEST_ID, request.id)

    return next.handle().pipe()
  }
}

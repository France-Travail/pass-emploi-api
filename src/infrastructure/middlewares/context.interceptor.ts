import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Observable } from 'rxjs'
import { Context, ContextKey } from '../../building-blocks/context'
import { getAPMInstance } from '../monitoring/apm.init'

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  private logger: Logger
  private apmService: APM.Agent

  constructor(private context: Context) {
    this.apmService = getAPMInstance()
    this.logger = new Logger('ContextInterceptor')
  }

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

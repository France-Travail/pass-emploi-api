import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class DelaiDeReponseInterceptor implements NestInterceptor {
  intercept(
    _executionContext: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    return next.handle()
  }
}

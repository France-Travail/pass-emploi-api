import { ExecutionContext } from '@nestjs/common'
import { of } from 'rxjs'
import { Context, ContextKey } from '../../../src/building-blocks/context'
import { ContextInterceptor } from '../../../src/infrastructure/middlewares/context.interceptor'
import { expect } from '../../utils'

describe('ContextInterceptor', () => {
  const unExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-1', authenticated: undefined })
      })
    }) as unknown as ExecutionContext

  it('pose toujours l’identifiant de requête', () => {
    // Given
    const context = new Context()
    const interceptor = new ContextInterceptor(context)

    // When
    interceptor
      .intercept(unExecutionContext(), { handle: () => of(undefined) })
      .subscribe()

    // Then
    expect(context.get(ContextKey.HTTP_REQUEST_ID)).to.equal('req-1')
  })
})

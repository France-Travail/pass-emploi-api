import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { of } from 'rxjs'
import { createSandbox, SinonSandbox } from 'sinon'
import { Context, ContextKey } from '../../../src/building-blocks/context'
import { ContextInterceptor } from '../../../src/infrastructure/middlewares/context.interceptor'
import { USER_JOURNEY_METADATA } from '../../../src/infrastructure/monitoring/user-journey.decorator'
import { expect } from '../../utils'

describe('ContextInterceptor', () => {
  const sandbox: SinonSandbox = createSandbox()
  let context: Context
  let reflector: Reflector

  const handler = (): void => undefined

  const unExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-1', authenticated: undefined })
      }),
      getHandler: () => handler
    }) as unknown as ExecutionContext

  const executer = (interceptor: ContextInterceptor): void => {
    interceptor
      .intercept(unExecutionContext(), { handle: () => of(undefined) })
      .subscribe()
  }

  beforeEach(() => {
    context = new Context()
    reflector = new Reflector()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('user journey', () => {
    it('pose le parcours dans le contexte quand la route est décorée', () => {
      // Given
      Reflect.defineMetadata(USER_JOURNEY_METADATA, 'accueil_jeune', handler)
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.equal('accueil_jeune')
    })

    it('ne pose rien quand la route ne porte pas le décorateur', () => {
      // Given
      Reflect.deleteMetadata(USER_JOURNEY_METADATA, handler)
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.equal(undefined)
    })
  })

  it('pose toujours l’identifiant de requête', () => {
    // Given
    const interceptor = new ContextInterceptor(context, reflector)

    // When
    executer(interceptor)

    // Then
    expect(context.get(ContextKey.HTTP_REQUEST_ID)).to.equal('req-1')
  })
})

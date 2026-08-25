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
  class UnController {}

  const unExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-1', authenticated: undefined })
      }),
      getHandler: () => handler,
      getClass: () => UnController
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
    afterEach(() => {
      Reflect.deleteMetadata(USER_JOURNEY_METADATA, handler)
      Reflect.deleteMetadata(USER_JOURNEY_METADATA, UnController)
    })

    it('pose le parcours dans le contexte quand la route est décorée', () => {
      // Given
      Reflect.defineMetadata(USER_JOURNEY_METADATA, 'accueil_jeune', handler)
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.equal('accueil_jeune')
    })

    it('reprend le parcours du controller quand seule la classe est décorée', () => {
      // Given
      Reflect.defineMetadata(USER_JOURNEY_METADATA, 'favoris', UnController)
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.equal('favoris')
    })

    it('fait primer le parcours de la route sur celui du controller', () => {
      // Given
      Reflect.defineMetadata(USER_JOURNEY_METADATA, 'favoris', UnController)
      Reflect.defineMetadata(USER_JOURNEY_METADATA, 'accueil_jeune', handler)
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.equal('accueil_jeune')
    })

    it('ne pose rien quand ni la route ni le controller ne portent le décorateur', () => {
      // Given
      const interceptor = new ContextInterceptor(context, reflector)

      // When
      executer(interceptor)

      // Then
      expect(context.get(ContextKey.USER_JOURNEY)).to.be.undefined()
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

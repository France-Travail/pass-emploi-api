import { ExecutionContext, GatewayTimeoutException } from '@nestjs/common'
import { NEVER } from 'rxjs'
import { SinonFakeTimers } from 'sinon'
import { DELAI_REPONSE_HTTP_MS } from '../../../src/config/configuration'
import { DelaiDeReponseInterceptor } from '../../../src/infrastructure/middlewares/delai-de-reponse.interceptor'
import { createSandbox, expect } from '../../utils'

describe('DelaiDeReponseInterceptor', () => {
  const sandbox = createSandbox()
  let clock: SinonFakeTimers

  beforeEach(() => {
    clock = sandbox.useFakeTimers()
  })

  afterEach(() => {
    sandbox.restore()
  })

  const uneRequete = (contentType?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'content-type': contentType } })
      })
    }) as unknown as ExecutionContext

  const erreurDUneRouteQuiNeRepondJamais = (
    requete: ExecutionContext
  ): { erreur?: unknown } => {
    const recu: { erreur?: unknown } = {}
    new DelaiDeReponseInterceptor()
      .intercept(requete, { handle: () => NEVER })
      .subscribe({ error: erreur => (recu.erreur = erreur) })
    return recu
  }

  it('répond en 504 quand la route n’a pas répondu dans le délai', () => {
    // Given
    const recu = erreurDUneRouteQuiNeRepondJamais(uneRequete())

    // When
    clock.tick(DELAI_REPONSE_HTTP_MS)

    // Then
    expect(recu.erreur).to.be.an.instanceOf(GatewayTimeoutException)
  })
})

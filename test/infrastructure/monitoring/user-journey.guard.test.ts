import { ClassProvider, ExecutionContext } from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { buildModuleMetadata } from '../../../src/app.module'
import { OidcAuthGuard } from '../../../src/infrastructure/auth/oidc.auth-guard'
import { USER_JOURNEY_METADATA } from '../../../src/infrastructure/monitoring/user-journey.decorator'
import {
  RequeteAvecUserJourney,
  UserJourneyGuard
} from '../../../src/infrastructure/monitoring/user-journey.guard'
import { expect } from '../../utils'

describe('UserJourneyGuard', () => {
  const handler = (): void => undefined
  class UnController {}
  let requete: RequeteAvecUserJourney
  let guard: UserJourneyGuard

  const unExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => requete }),
      getHandler: () => handler,
      getClass: () => UnController
    }) as unknown as ExecutionContext

  beforeEach(() => {
    requete = {}
    guard = new UserJourneyGuard(new Reflector())
  })

  afterEach(() => {
    Reflect.deleteMetadata(USER_JOURNEY_METADATA, handler)
    Reflect.deleteMetadata(USER_JOURNEY_METADATA, UnController)
  })

  it('pose le parcours sur la requête quand la route est décorée', () => {
    // Given
    Reflect.defineMetadata(USER_JOURNEY_METADATA, 'accueil_jeune', handler)

    // When
    guard.canActivate(unExecutionContext())

    // Then
    expect(requete.userJourney).to.equal('accueil_jeune')
  })

  it('reprend le parcours du controller quand seule la classe est décorée', () => {
    // Given
    Reflect.defineMetadata(USER_JOURNEY_METADATA, 'favoris', UnController)

    // When
    guard.canActivate(unExecutionContext())

    // Then
    expect(requete.userJourney).to.equal('favoris')
  })

  it('fait primer le parcours de la route sur celui du controller', () => {
    // Given
    Reflect.defineMetadata(USER_JOURNEY_METADATA, 'favoris', UnController)
    Reflect.defineMetadata(USER_JOURNEY_METADATA, 'accueil_jeune', handler)

    // When
    guard.canActivate(unExecutionContext())

    // Then
    expect(requete.userJourney).to.equal('accueil_jeune')
  })

  it('ne pose rien quand ni la route ni le controller ne portent le décorateur', () => {
    // When
    guard.canActivate(unExecutionContext())

    // Then
    expect(requete.userJourney).to.be.undefined()
  })

  it('laisse toujours passer la requête', () => {
    // When
    const resultat = guard.canActivate(unExecutionContext())

    // Then
    expect(resultat).to.be.true()
  })

  it("passe avant OidcAuthGuard, pour que les refus d'authentification portent leur parcours", () => {
    // When
    const guardsGlobaux = buildModuleMetadata()
      .providers!.filter(
        (provider): provider is ClassProvider =>
          typeof provider === 'object' &&
          'provide' in provider &&
          provider.provide === APP_GUARD
      )
      .map(provider => provider.useClass)

    // Then
    expect(guardsGlobaux).to.deep.equal([UserJourneyGuard, OidcAuthGuard])
  })
})

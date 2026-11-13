import { ConfigService } from '@nestjs/config'
import * as sinon from 'sinon'
import { lireRateLimitConfig } from '../../../src/infrastructure/rate-limit/rate-limit.config'
import { rootLogger } from '../../../src/utils/logger.module'
import { expect } from '../../utils'

describe('lireRateLimitConfig', () => {
  let logError: sinon.SinonStub
  let logInfo: sinon.SinonStub

  beforeEach(() => {
    logError = sinon.stub(rootLogger, 'error')
    logInfo = sinon.stub(rootLogger, 'info')
  })

  afterEach(() => {
    logError.restore()
    logInfo.restore()
  })

  it('renvoie undefined quand RATE_LIMIT_ACTIF est absent', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: false,
        utilisateur: {
          fenetreSecondes: 60,
          limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
        },
        ip: { fenetreSecondes: 60, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600, limite: 10 }
      }
    })

    // When
    const result = lireRateLimitConfig(configService)

    // Then
    expect(result).to.be.undefined()
    expect(logError).not.to.have.been.called()
    expect(logInfo).not.to.have.been.called()
  })

  it('convertit les fenêtres de secondes en millisecondes', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: 60,
          limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
        },
        ip: { fenetreSecondes: 120, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600, limite: 10 }
      }
    })

    // When
    const result = lireRateLimitConfig(configService)

    // Then
    expect(result).to.deep.equal({
      utilisateur: {
        fenetreMs: 60000,
        limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
      },
      ip: { fenetreMs: 120000, limite: 500 },
      routeCouteuse: { fenetreMs: 3600000, limite: 10 }
    })
    expect(logError).not.to.have.been.called()
  })

  it('renvoie undefined et logue rate_limit_config_invalide si une limite manque', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: 60,
          limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200 }
        },
        ip: { fenetreSecondes: 60, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600, limite: 10 }
      }
    })

    // When
    const result = lireRateLimitConfig(configService)

    // Then
    expect(result).to.be.undefined()
    expect(logError).to.have.been.calledOnce()
    expect(logError).to.have.been.calledWithExactly(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_config_invalide', outcome: 'failure' },
        labels: {
          rate_limit_variables_invalides:
            'RATE_LIMIT_UTILISATEUR_LIMITE_SUPPORT'
        }
      },
      'rate_limit_config_invalide'
    )
  })

  it("renvoie undefined si une limite vaut 0 ou n'est pas numérique", () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: 60,
          limites: { JEUNE: 0, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
        },
        ip: { fenetreSecondes: 60, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600, limite: 10 }
      }
    })

    // When
    const result = lireRateLimitConfig(configService)

    // Then
    expect(result).to.be.undefined()
    expect(logError).to.have.been.calledOnce()
  })

  it('nomme dans le log toutes les variables absentes ou invalides', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: undefined,
          limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
        },
        ip: { fenetreSecondes: 60, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600 }
      }
    })

    // When
    const result = lireRateLimitConfig(configService)

    // Then
    expect(result).to.be.undefined()
    expect(logError).to.have.been.calledOnce()
    expect(
      logError.getCall(0).args[0].labels.rate_limit_variables_invalides
    ).to.equal(
      'RATE_LIMIT_UTILISATEUR_FENETRE_SECONDES,RATE_LIMIT_ROUTE_COUTEUSE_LIMITE'
    )
  })

  it('logue rate_limit_activated avec les seuils quand la config est valide', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: 60,
          limites: { JEUNE: 100, INVITE: 50, CONSEILLER: 200, SUPPORT: 300 }
        },
        ip: { fenetreSecondes: 120, limite: 500 },
        routeCouteuse: { fenetreSecondes: 3600, limite: 10 }
      }
    })

    // When
    lireRateLimitConfig(configService)

    // Then
    expect(logInfo).to.have.been.calledOnceWithExactly(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_activated', outcome: 'success' },
        labels: {
          rate_limit_seuils:
            'RATE_LIMIT_UTILISATEUR_FENETRE_SECONDES=60,' +
            'RATE_LIMIT_UTILISATEUR_LIMITE_JEUNE=100,' +
            'RATE_LIMIT_UTILISATEUR_LIMITE_INVITE=50,' +
            'RATE_LIMIT_UTILISATEUR_LIMITE_CONSEILLER=200,' +
            'RATE_LIMIT_UTILISATEUR_LIMITE_SUPPORT=300,' +
            'RATE_LIMIT_IP_FENETRE_SECONDES=120,' +
            'RATE_LIMIT_IP_LIMITE=500,' +
            'RATE_LIMIT_ROUTE_COUTEUSE_FENETRE_SECONDES=3600,' +
            'RATE_LIMIT_ROUTE_COUTEUSE_LIMITE=10'
        }
      },
      'rate_limit_activated'
    )
  })
})

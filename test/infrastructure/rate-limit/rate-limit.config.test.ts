import { ConfigService } from '@nestjs/config'
import * as sinon from 'sinon'
import { lireRateLimitConfig } from '../../../src/infrastructure/rate-limit/rate-limit.config'
import { rootLogger } from '../../../src/utils/logger.module'
import { expect } from '../../utils'

describe('lireRateLimitConfig', () => {
  let logError: sinon.SinonStub

  beforeEach(() => {
    logError = sinon.stub(rootLogger, 'error')
  })

  afterEach(() => {
    logError.restore()
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
    const logArgs = logError.getCall(0).args[0]
    expect(logArgs.event.action).to.equal('rate_limit_config_invalide')
    expect(logArgs.event.outcome).to.equal('failure')
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

  it('renvoie undefined si une fenêtre est invalide', () => {
    // Given
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        utilisateur: {
          fenetreSecondes: undefined,
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
    expect(logError).to.have.been.calledOnce()
  })
})

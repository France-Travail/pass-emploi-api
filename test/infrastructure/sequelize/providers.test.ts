import { ConfigService } from '@nestjs/config'
import { TIMEOUT_REQUETE_HTTP_MS } from '../../../src/config/configuration'
import { construireDialectOptions } from '../../../src/infrastructure/sequelize/providers'
import { expect } from '../../utils'

describe('construireDialectOptions', () => {
  it('aligne le statement_timeout du process web sur le timeout HTTP', () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: true,
      isWorker: false,
      task: {}
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({
      statement_timeout: TIMEOUT_REQUETE_HTTP_MS
    })
  })

  it("n'impose aucun statement_timeout au worker, même sans IS_WEB=false", () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: true,
      isWorker: true,
      task: {}
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({})
  })

  it("n'impose aucun statement_timeout à une task, même sans IS_WEB=false", () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: true,
      isWorker: false,
      task: { name: 'INIT_CRONS' }
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({})
  })

  it('garde le SSL de staging à côté du statement_timeout', () => {
    // Given
    const configService = new ConfigService({
      environment: 'staging',
      isWeb: true,
      isWorker: false,
      task: {}
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({
      ssl: { require: true, rejectUnauthorized: false },
      statement_timeout: TIMEOUT_REQUETE_HTTP_MS
    })
  })
})

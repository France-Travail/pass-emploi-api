import { ConfigService } from '@nestjs/config'
import { construireDialectOptions } from '../../../src/infrastructure/sequelize/providers'
import { expect } from '../../utils'

describe('construireDialectOptions', () => {
  it('transmet le statement_timeout à Postgres pour le process web', () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: true,
      database: { statementTimeoutMsWeb: 30000 }
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({ statement_timeout: 30000 })
  })

  it("n'impose aucun statement_timeout au worker ni aux tasks", () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: false,
      database: { statementTimeoutMsWeb: 30000 }
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({})
  })

  it("n'impose aucun statement_timeout quand il n'est pas configuré", () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      isWeb: true,
      database: {}
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
      database: { statementTimeoutMsWeb: 30000 }
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({
      ssl: { require: true, rejectUnauthorized: false },
      statement_timeout: 30000
    })
  })
})

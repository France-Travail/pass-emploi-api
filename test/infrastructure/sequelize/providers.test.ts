import { ConfigService } from '@nestjs/config'
import { construireDialectOptions } from '../../../src/infrastructure/sequelize/providers'
import { expect } from '../../utils'

describe('construireDialectOptions', () => {
  it('transmet le statement_timeout à Postgres quand il est configuré', () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
      database: { statementTimeoutMs: 30000 }
    })

    // When
    const dialectOptions = construireDialectOptions(configService)

    // Then
    expect(dialectOptions).to.deep.equal({ statement_timeout: 30000 })
  })

  it("n'impose aucun statement_timeout quand il n'est pas configuré", () => {
    // Given
    const configService = new ConfigService({
      environment: 'prod',
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
      database: { statementTimeoutMs: 30000 }
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

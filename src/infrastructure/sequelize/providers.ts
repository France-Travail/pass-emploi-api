import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Sequelize } from 'sequelize-typescript'
import { buildError } from '../../utils/logger.module'
import { sqlModels } from './models'
import { activerTransactionsImplicites } from './transactions-implicites'

export const SequelizeInjectionToken = 'SEQUELIZE'

export function construireDialectOptions(
  configService: ConfigService
): Record<string, unknown> {
  const dialectOptions: Record<string, unknown> = {}
  if (configService.get('environment') === 'staging') {
    dialectOptions.ssl = { require: true, rejectUnauthorized: false }
  }

  // statement_timeout fait annuler la requête par Postgres ; query_timeout
  // ne fait que l'abandonner côté Node, elle continue alors de tourner en base.
  const statementTimeoutMs = configService.get<number>(
    'database.statementTimeoutMsWeb'
  )
  if (configService.get<boolean>('isWeb') && statementTimeoutMs) {
    dialectOptions.statement_timeout = statementTimeoutMs
  }
  return dialectOptions
}

export const databaseProviders = [
  {
    provide: SequelizeInjectionToken,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService): Promise<Sequelize> => {
      activerTransactionsImplicites()
      const sequelize = new Sequelize({
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        dialect: 'postgres',
        username: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        benchmark: configService.get<string>('logLevel') === 'trace',
        logging: false,
        pool: {
          max: configService.get<number>('database.maxConnections'),
          min: configService.get<number>('database.minConnections'),
          acquire: configService.get<number>('database.acquireConnections'),
          idle: configService.get<number>('database.idleConnections'),
          evict: configService.get<number>('database.evictConnections')
        },
        dialectOptions: construireDialectOptions(configService)
      })
      sequelize.addModels(sqlModels)
      const logger = new Logger('Sequelize')
      try {
        logger.log('Connecting to PostgreSQL database')
        await sequelize.authenticate()
        logger.log('Connection with the PostgreSQL database is OK')
        return sequelize
      } catch (e) {
        logger.error(
          buildError('Error connecting to the PostgreSQL database', e)
        )
        throw e
      }
    }
  }
]

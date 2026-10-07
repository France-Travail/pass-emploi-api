import { Sequelize } from 'sequelize-typescript'
import { sqlModels } from '../../src/infrastructure/sequelize/models'
import { activerTransactionsImplicites } from '../../src/infrastructure/sequelize/transactions-implicites'
import { createClient } from 'redis'
import { testConfig } from './test-config'
import { RedisClientType as _RedisClientType } from '@redis/client/dist/lib/client'

export let databaseForTesting: DatabaseForTesting | undefined

export class DatabaseForTesting {
  sequelize!: Sequelize
  redisClient: _RedisClientType

  constructor() {
    const { host, port, database, user, password } =
      testConfig().get('database')
    activerTransactionsImplicites()
    this.sequelize = new Sequelize({
      host: host as string,
      port: parseInt(port as string),
      username: user as string,
      password: password as string,
      database: database as string,
      dialect: 'postgres',
      logging: false
    })
    this.sequelize.addModels(sqlModels)

    const redisUrl = testConfig().get('redis').url
    this.redisClient = createClient({
      url: redisUrl
    })
  }

  cleanPG = async (): Promise<void> => {
    const deletes = sqlModels
      .map(model => `DELETE FROM "${model.tableName}";`)
      .join('')
    await this.sequelize.query(
      `BEGIN; SET LOCAL session_replication_role = replica; ${deletes} COMMIT;`
    )
  }

  cleanRedis = async (): Promise<void> => {
    await this.redisClient.connect()
    await this.redisClient.flushAll()
    await this.redisClient.disconnect()
  }
}

export function getDatabase(): DatabaseForTesting {
  if (!databaseForTesting) {
    databaseForTesting = new DatabaseForTesting()
  }
  return databaseForTesting
}

databaseForTesting = getDatabase()

// eslint-disable-next-line no-console
console.log('Setting up database for testing')

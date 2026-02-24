import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Sequelize } from 'sequelize-typescript'
import configuration from '../config/configuration'
import { initializeAPMAgent } from '../infrastructure/monitoring/apm.init'
import {
  databaseProviders,
  SequelizeInjectionToken
} from '../infrastructure/sequelize/providers'

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.environment', load: [configuration] })
  ],
  providers: [...databaseProviders]
})
class CleanupScriptModule {}

const logger = new Logger('CleanupScript')

initializeAPMAgent()

async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(
    CleanupScriptModule,
    {
      logger: ['log', 'error', 'warn']
    }
  )
  const sequelize = context.get<Sequelize>(SequelizeInjectionToken)

  try {
    logger.log('Nettoyage des données de test migration')

    const [, archiveCount] = await sequelize.query(
      `DELETE FROM archive_jeune WHERE id_jeune LIKE 'test-migration-jeune-%'`
    )
    logger.log(`Archives supprimées : ${archiveCount}`)

    const [, jeuneCount] = await sequelize.query(
      `DELETE FROM jeune WHERE id LIKE 'test-migration-jeune-%'`
    )
    logger.log(`Jeunes supprimés : ${jeuneCount}`)

    const [, conseillerCount] = await sequelize.query(
      `DELETE FROM conseiller WHERE id = 'test-migration-conseiller'`
    )
    logger.log(`Conseillers supprimés : ${conseillerCount}`)

    const [, ffCount] = await sequelize.query(
      `DELETE FROM feature_flip WHERE feature_tag = 'MIGRATION_PHASE_TEST'`
    )
    logger.log(`Feature flips supprimés : ${ffCount}`)

    logger.log('Cleanup migration test terminé')
  } finally {
    await context.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Erreur cleanup:', err)
    process.exit(1)
  })

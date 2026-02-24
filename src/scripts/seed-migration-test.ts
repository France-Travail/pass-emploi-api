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

const DEFAULT_NB_JEUNES = 1000
const CONSEILLER_ID = 'test-migration-conseiller'
const CONSEILLER_EMAIL = 'test-migration@passemploi.com'

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.environment', load: [configuration] })
  ],
  providers: [...databaseProviders]
})
class SeedScriptModule {}

const logger = new Logger('SeedScript')

initializeAPMAgent()

async function main(): Promise<void> {
  const nbJeunes = process.argv[2]
    ? Number.parseInt(process.argv[2], 10)
    : DEFAULT_NB_JEUNES

  const context = await NestFactory.createApplicationContext(SeedScriptModule, {
    logger: ['log', 'error', 'warn']
  })
  const sequelize = context.get<Sequelize>(SequelizeInjectionToken)

  try {
    logger.log(`Insertion de ${nbJeunes} jeunes de test pour migration`)

    await sequelize.query(
      `INSERT INTO conseiller (id, prenom, nom, id_authentification, structure, email, notifications_sonores, date_creation, date_verification_messages)
       VALUES (:id, 'Test', 'Migration', :idAuth, 'PASS_EMPLOI', :email, false, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      {
        replacements: {
          id: CONSEILLER_ID,
          idAuth: 'test-migration-auth-conseiller',
          email: CONSEILLER_EMAIL
        }
      }
    )
    logger.log('Conseiller créé')

    const jeuneValues: string[] = []
    const replacements: Record<string, string> = {}
    for (let i = 1; i <= nbJeunes; i++) {
      const idx = String(i).padStart(4, '0')
      const key = `j${i}`
      jeuneValues.push(
        `(:${key}_id, 'Jeune', :${key}_nom, :${key}_idCons, :${key}_idAuth, NOW(), 'PASS_EMPLOI', 'CEJ', :${key}_email)`
      )
      replacements[`${key}_id`] = `test-migration-jeune-${idx}`
      replacements[`${key}_nom`] = `Test-${idx}`
      replacements[`${key}_idCons`] = CONSEILLER_ID
      replacements[`${key}_idAuth`] = `test-migration-auth-${idx}`
      replacements[
        `${key}_email`
      ] = `test-migration-jeune-${idx}@passemploi.com`
    }

    const batchSize = 250
    for (let start = 0; start < jeuneValues.length; start += batchSize) {
      const batch = jeuneValues.slice(start, start + batchSize)
      const batchReplacements: Record<string, string> = {}
      for (let i = start; i < start + batch.length; i++) {
        const key = `j${i + 1}`
        batchReplacements[`${key}_id`] = replacements[`${key}_id`]
        batchReplacements[`${key}_nom`] = replacements[`${key}_nom`]
        batchReplacements[`${key}_idCons`] = replacements[`${key}_idCons`]
        batchReplacements[`${key}_idAuth`] = replacements[`${key}_idAuth`]
        batchReplacements[`${key}_email`] = replacements[`${key}_email`]
      }

      await sequelize.query(
        `INSERT INTO jeune (id, prenom, nom, id_conseiller, id_authentification, date_creation, structure, dispositif, email)
         VALUES ${batch.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        { replacements: batchReplacements }
      )
      logger.log(`Jeunes insérés : ${start + batch.length}/${nbJeunes}`)
    }

    await sequelize.query(
      `INSERT INTO feature_flip (email_conseiller, feature_tag)
       VALUES (:email, 'MIGRATION_PHASE_TEST')
       ON CONFLICT (feature_tag, email_conseiller) DO NOTHING`,
      { replacements: { email: CONSEILLER_EMAIL } }
    )
    logger.log('Feature flip créée')

    logger.log('Seed migration test terminé')
  } finally {
    await context.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Erreur seed:', err)
    process.exit(1)
  })

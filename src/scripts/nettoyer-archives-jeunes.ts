import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { parseArgs } from 'node:util'
import { NettoyerArchivesJeunesCommandHandler } from '../application/commands/nettoyer-archives-jeunes.command.handler'
import { isFailure } from '../building-blocks/types/result'
import configuration from '../config/configuration'
import { Authentification } from '../domain/authentification'
import { MigrationRepositoryToken } from '../domain/migration'
import { PlanificateurRepositoryToken } from '../domain/planificateur'
import { initializeAPMAgent } from '../infrastructure/monitoring/apm.init'
import { MigrationSqlRepository } from '../infrastructure/repositories/migration.repository.db'
import { PlanificateurRedisRepository } from '../infrastructure/repositories/planificateur-redis.repository.db'
import { databaseProviders } from '../infrastructure/sequelize/providers'
import { DateService } from '../utils/date-service'

const USAGE = `Usage : yarn nettoyer-archives-jeunes [idPopulation]
Planifie le job NETTOYER_ARCHIVES_JEUNES sans attendre le cron de nuit : restreint à la population si elle est fournie, sur toutes les archives à nettoyer sinon.
Staging : scalingo --app pass-emploi-api-staging run yarn nettoyer-archives-jeunes <idPopulation>`

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.environment', load: [configuration] })
  ],
  providers: [
    ...databaseProviders,
    DateService,
    NettoyerArchivesJeunesCommandHandler,
    { provide: MigrationRepositoryToken, useClass: MigrationSqlRepository },
    {
      provide: PlanificateurRepositoryToken,
      useClass: PlanificateurRedisRepository
    }
  ]
})
class NettoyerArchivesJeunesModule {}

const logger = new Logger('NettoyerArchivesJeunes')

export function lireIdPopulation(argv: string[]): string | undefined {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true })
  if (positionals.length > 1) {
    throw new Error(USAGE)
  }
  return positionals[0]
}

export async function planifierNettoyageDesArchives(
  commandHandler: NettoyerArchivesJeunesCommandHandler,
  idPopulation: string | undefined
): Promise<void> {
  const result = await commandHandler.execute(
    { idPopulationQuiMigre: idPopulation },
    Authentification.unUtilisateurSupport()
  )
  if (isFailure(result)) {
    throw new Error(
      `Population ${idPopulation} : aucun déploiement de nature MIGRATION ne la vise, rien n'est planifié`
    )
  }
}

async function main(): Promise<void> {
  const idPopulation = lireIdPopulation(process.argv.slice(2))

  const context = await NestFactory.createApplicationContext(
    NettoyerArchivesJeunesModule,
    { logger: ['log', 'error', 'warn'] }
  )

  const planificateur = context.get<PlanificateurRedisRepository>(
    PlanificateurRepositoryToken
  )

  try {
    await planificateur.isQueueReady()
    await planifierNettoyageDesArchives(
      context.get(NettoyerArchivesJeunesCommandHandler),
      idPopulation
    )
    logger.log(
      `Job NETTOYER_ARCHIVES_JEUNES planifié ${idPopulation ? `pour la population ${idPopulation}` : 'sur toutes les archives à nettoyer'}, le worker le traite`
    )
  } finally {
    await planificateur.disconnect()
    await context.close()
  }
}

if (require.main === module) {
  initializeAPMAgent()
  main()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}

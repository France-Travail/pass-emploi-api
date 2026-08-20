import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { QueryTypes } from 'sequelize'
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
class PurgeScriptModule {}

const logger = new Logger('PurgeRecherchesDoublons')

export interface StatsPurge {
  groupesDupliques: number
  jeunesImpactes: number
  lignesEnTrop: number
  pireCas: number
  suggestionsPerdues: number
  lignesSupprimees: number
}

// Une ligne à garder par groupe (id_jeune, type, criteres) : en priorité celle
// qui porte une suggestion, car suggestion.id_recherche est en ON DELETE
// CASCADE et supprimer la recherche emporterait la suggestion avec elle
const CLASSEMENT_DES_DOUBLONS = `
  WITH enrichi AS (
    SELECT r.id,
           r.id_jeune,
           r.type,
           r.criteres,
           r.date_creation,
           EXISTS (
             SELECT 1 FROM suggestion s WHERE s.id_recherche = r.id
           ) AS a_suggestion
      FROM recherche r
  ),
  classement AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY id_jeune, type, criteres
             ORDER BY a_suggestion DESC, date_creation ASC, id ASC
           ) AS rang
      FROM enrichi
  )
`

export async function purgerLesRecherchesEnDoublon(
  sequelize: Sequelize,
  options: { dryRun: boolean }
): Promise<StatsPurge> {
  const [ampleur] = await sequelize.query<{
    groupesDupliques: number
    jeunesImpactes: number
    lignesEnTrop: number
    pireCas: number
  }>(
    `WITH groupes AS (
       SELECT id_jeune, count(*) AS nb
         FROM recherche
        GROUP BY id_jeune, type, criteres
     )
     SELECT count(*) FILTER (WHERE nb > 1)::int AS "groupesDupliques",
            count(DISTINCT id_jeune) FILTER (WHERE nb > 1)::int AS "jeunesImpactes",
            coalesce(sum(nb - 1), 0)::int AS "lignesEnTrop",
            coalesce(max(nb), 0)::int AS "pireCas"
       FROM groupes`,
    { type: QueryTypes.SELECT }
  )

  const [suggestions] = await sequelize.query<{ suggestionsPerdues: number }>(
    `${CLASSEMENT_DES_DOUBLONS}
     SELECT count(*)::int AS "suggestionsPerdues"
       FROM suggestion s
       JOIN classement c ON c.id = s.id_recherche
      WHERE c.rang > 1`,
    { type: QueryTypes.SELECT }
  )

  const stats: StatsPurge = {
    ...ampleur,
    ...suggestions,
    lignesSupprimees: 0
  }

  if (options.dryRun) {
    return stats
  }

  await sequelize.transaction(async transaction => {
    stats.lignesSupprimees = await sequelize.query(
      `${CLASSEMENT_DES_DOUBLONS}
       DELETE FROM recherche
        WHERE id IN (SELECT id FROM classement WHERE rang > 1)`,
      { type: QueryTypes.BULKDELETE, transaction }
    )
  })

  return stats
}

async function main(): Promise<void> {
  // Le mode sec est le défaut : la suppression demande --execute explicitement
  const dryRun = !process.argv.includes('--execute')

  const context = await NestFactory.createApplicationContext(
    PurgeScriptModule,
    { logger: ['log', 'error', 'warn'] }
  )
  const sequelize = context.get<Sequelize>(SequelizeInjectionToken)

  try {
    logger.log(
      dryRun
        ? 'Mode simulation, aucune suppression (ajouter --execute pour purger)'
        : 'Mode suppression'
    )

    const stats = await purgerLesRecherchesEnDoublon(sequelize, { dryRun })

    logger.log(`Groupes en doublon : ${stats.groupesDupliques}`)
    logger.log(`Bénéficiaires impactés : ${stats.jeunesImpactes}`)
    logger.log(`Lignes en trop : ${stats.lignesEnTrop}`)
    logger.log(`Pire cas sur un seul groupe : ${stats.pireCas}`)
    logger.log(
      `Suggestions emportées par la cascade : ${stats.suggestionsPerdues}`
    )

    if (dryRun) {
      logger.log('Simulation terminée, rien n’a été supprimé')
    } else {
      logger.log(`Lignes supprimées : ${stats.lignesSupprimees}`)
    }
  } finally {
    await context.close()
  }
}

if (require.main === module) {
  initializeAPMAgent()
  main()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error('Erreur purge:', err)
      process.exit(1)
    })
}

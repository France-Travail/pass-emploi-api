import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes } from 'sequelize'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import { Planificateur, ProcessJobType } from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { createSequelizeForAnalytics } from '../../../infrastructure/sequelize/connector-analytics'
import { DateService } from '../../../utils/date-service'
import { infosTablesAEAnnuelles } from './creer-tables-ae-annuelles'
import { migrate } from './vues/3-0-migrate-schema'
import { chargerLaVueFonctionnaliteDemarchesIA } from './vues/3-1bis-vue-fonctionnalites-demarches-ia'

/**
 * Analytics pipeline — maintenance (hors chaîne quotidienne).
 * Recalcule uniquement analytics_fonctionnalites_demarches_ia sur tout l'historique :
 * bêta-testeurs avant la généralisation, tous les bénéficiaires ensuite.
 * @see docs/ANALYTICS.md#initialiser-les-vuesjobts
 * @analytics.trigger TASK_NAME=INITIALISER_LA_VUE_DEMARCHES_IA (Scalingo)
 * @analytics.scope analytics_fonctionnalites_demarches_ia, tout l'historique
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.INITIALISER_LA_VUE_DEMARCHES_IA)
export class InitialiserLaVueDemarchesIAJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService
  ) {
    super(
      Planificateur.JobType.INITIALISER_LA_VUE_DEMARCHES_IA,
      suiviJobService
    )
  }

  async handle(): Promise<SuiviJob> {
    let erreur
    const maintenant = this.dateService.now()
    try {
      const connexion = await createSequelizeForAnalytics()
      this.logger.log('Migrer le schéma des vues analytics')
      await migrate(connexion)

      for (const tableAnnuelle of infosTablesAEAnnuelles) {
        const tableName = `evenement_engagement${tableAnnuelle.suffix}`
        const semaines = await connexion.query<{ semaine: string }>(
          `SELECT distinct(semaine) from ${tableName} WHERE EXTRACT(YEAR FROM semaine) >= ${tableAnnuelle.depuisAnnee} ORDER BY semaine;`,
          { raw: true, type: QueryTypes.SELECT }
        )

        for (const raw of semaines) {
          this.logger.log(
            `Charger la vue fonctionnalité démarches IA de la semaine ${raw.semaine}`
          )
          await chargerLaVueFonctionnaliteDemarchesIA(
            connexion,
            raw.semaine,
            tableName
          )
        }
      }

      await connexion.close()
    } catch (e) {
      erreur = e
      this.logger.error(e)
    }

    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: erreur ? false : true,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {}
    }
  }
}

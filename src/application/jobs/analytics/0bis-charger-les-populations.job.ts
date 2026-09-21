import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import { Planificateur, ProcessJobType } from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { PopulationSqlRepository } from '../../../infrastructure/repositories/population.repository.db'
import { sqlJoinConseillerDeReference } from '../../../infrastructure/repositories/sql-helpers'
import { createSequelizeForAnalytics } from '../../../infrastructure/sequelize/connector-analytics'
import { DateService } from '../../../utils/date-service'

export const ANALYTICS_POPULATION_MEMBRES_TABLE_NAME =
  'analytics_population_membres'

interface Volumetrie {
  nbPopulations: number
  nbConseillers: number
  nbJeunes: number
}

interface Membre {
  idPopulation: string
  idUtilisateur: string
}

/**
 * Analytics pipeline — step 0bis (quotidien, en parallèle du job 1).
 * La résolution d'appartenance passe par PopulationSqlRepository (la classe
 * de production) pointée sur la base Analytics : elle n'est jamais
 * réimplémentée ici, seul l'enrichissement présentation l'est.
 * @see docs/ANALYTICS.md#0bis-charger-les-populationsjobts
 * @analytics.trigger ajouterJob depuis DUMP_ANALYTICS, ou TASK_NAME=CHARGER_POPULATIONS_ANALYTICS
 * @analytics.after DUMP_ANALYTICS
 * @analytics.tables_in population, population_conseiller, population_profil, conseiller, jeune
 * @analytics.tables_out analytics_population_membres
 */
@Injectable()
@ProcessJobType(Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS)
export class ChargerLesPopulationsJobHandler extends JobHandler {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService
  ) {
    super(Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    let erreur
    let volumetrie: Volumetrie | undefined
    const maintenant = this.dateService.now()
    try {
      const connexion = await createSequelizeForAnalytics()
      await this.creerLaTable(connexion)
      const populationRepository = new PopulationSqlRepository(connexion)

      const idsPopulations = await this.recupererLesIdsDesPopulations(connexion)
      const conseillers: Membre[] = []
      const jeunes: Membre[] = []
      for (const idPopulation of idsPopulations) {
        const idsConseillers =
          await populationRepository.getIdsDesConseillersParProfilOuConseillerCite(
            idPopulation
          )
        const idsJeunes =
          await populationRepository.getIdsDesJeunesParProfilOuConseillerCite(
            idPopulation
          )
        conseillers.push(
          ...idsConseillers.map(idUtilisateur => ({
            idPopulation,
            idUtilisateur
          }))
        )
        jeunes.push(
          ...idsJeunes.map(idUtilisateur => ({ idPopulation, idUtilisateur }))
        )
      }

      await connexion.transaction(async transaction => {
        await connexion.query(
          `DELETE FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};`,
          { transaction }
        )
        await this.ecrireLesConseillers(
          connexion,
          conseillers,
          maintenant.toJSDate(),
          transaction
        )
        await this.ecrireLesJeunes(
          connexion,
          jeunes,
          maintenant.toJSDate(),
          transaction
        )
      })
      volumetrie = {
        nbPopulations: idsPopulations.length,
        nbConseillers: conseillers.length,
        nbJeunes: jeunes.length
      }
      await connexion.close()
    } catch (e) {
      erreur = e
      this.logger.error(e)
    }

    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: !erreur,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: volumetrie ?? {}
    }
  }

  private async creerLaTable(connexion: Sequelize): Promise<void> {
    await connexion.query(`
      CREATE TABLE IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
      (
        id_population              varchar     NOT NULL,
        type_utilisateur           varchar     NOT NULL,
        id_utilisateur             varchar     NOT NULL,
        email                      varchar,
        nom                        varchar,
        prenom                     varchar,
        structure                  varchar,
        dispositif                 varchar,
        agence                     varchar,
        email_conseiller_reference varchar,
        type_conseiller_reference  varchar,
        date_calcul                timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}_id_population_index
        ON ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME} (id_population);
    `)
  }

  private async recupererLesIdsDesPopulations(
    connexion: Sequelize
  ): Promise<string[]> {
    const rows = await connexion.query<{ id: string }>(
      `SELECT id FROM population;`,
      { type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }

  // Présentation pure : l'appartenance est déjà tranchée par PopulationSqlRepository,
  // aucun prédicat métier ne doit apparaître dans ces requêtes.
  private async ecrireLesConseillers(
    connexion: Sequelize,
    conseillers: Membre[],
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<void> {
    if (conseillers.length === 0) return

    await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT m.id_population, 'CONSEILLER', c.id, c.email, c.nom, c.prenom, c.structure, c.dispositif,
               COALESCE(sm.nom_officiel, a.nom_agence),
               NULL, NULL, :dateCalcul
        FROM (VALUES ${sqlValues(conseillers)}) AS m(id_population, id_utilisateur)
        JOIN conseiller c ON c.id = m.id_utilisateur
        LEFT JOIN structure_milo sm ON sm.id = c.id_structure_milo
        LEFT JOIN agence a ON a.id = c.id_agence;
      `,
      { replacements: { dateCalcul }, transaction }
    )
  }

  private async ecrireLesJeunes(
    connexion: Sequelize,
    jeunes: Membre[],
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<void> {
    if (jeunes.length === 0) return

    await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT m.id_population, 'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
               COALESCE(smj.nom_officiel, smc.nom_officiel, a.nom_agence),
               c.email,
               CASE WHEN j.id_conseiller_initial IS NULL THEN 'ACTUEL' ELSE 'INITIAL' END,
               :dateCalcul
        FROM (VALUES ${sqlValues(jeunes)}) AS m(id_population, id_utilisateur)
        JOIN jeune j ON j.id = m.id_utilisateur
        ${sqlJoinConseillerDeReference('j', 'c')}
        LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
        LEFT JOIN structure_milo smc ON smc.id = c.id_structure_milo
        LEFT JOIN agence a ON a.id = c.id_agence;
      `,
      { replacements: { dateCalcul }, transaction }
    )
  }
}

// Identifiants internes lus en base juste avant (jamais une saisie utilisateur) : interpolés tels quels.
function sqlValues(membres: Membre[]): string {
  return membres
    .map(m => `('${m.idPopulation}', '${m.idUtilisateur}')`)
    .join(', ')
}

import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import { Planificateur, ProcessJobType } from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import { PopulationSqlRepository } from '../../../infrastructure/repositories/population.repository.db'
import {
  sqlCommunicationEnCours,
  sqlDeploiementActif,
  sqlJoinConseillerDeReference,
  sqlJoinConseillersConcernes,
  sqlJoinConseillersDestinataires
} from '../../../infrastructure/repositories/sql-helpers'
import { createSequelizeForAnalytics } from '../../../infrastructure/sequelize/connector-analytics'
import { DateService } from '../../../utils/date-service'
import { rootLogger, toEcsError } from '../../../utils/logger.module'

export const ANALYTICS_POPULATION_MEMBRES_TABLE_NAME =
  'analytics_population_membres'
export const ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME =
  'analytics_communication_destinataires'
export const ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME =
  'analytics_deploiement_membres'

interface Volumetrie {
  nbPopulations: number
  nbConseillers: number
  nbJeunes: number
  nbDestinatairesCommunications: number
  nbMembresDeploiements: number
}

interface Membre {
  idPopulation: string
  idUtilisateur: string
}

interface Ecriture {
  dateCalcul: Date
  transaction: Transaction
}

const COLONNES_UTILISATEUR = `
  id_utilisateur   varchar NOT NULL,
  email            varchar,
  nom              varchar,
  prenom           varchar,
  structure        varchar,
  dispositif       varchar,
  id_agence        varchar,
  agence           varchar`

// Identité et lieu d'accompagnement du conseiller `c` : structure MiLo sinon agence FT.
const SELECT_CONSEILLER = `c.id, c.email, c.nom, c.prenom, c.structure, c.dispositif,
  COALESCE(c.id_structure_milo, c.id_agence), COALESCE(sm.nom_officiel, a.nom_agence)`
const JOIN_LIEU_CONSEILLER = `
  LEFT JOIN structure_milo sm ON sm.id = c.id_structure_milo
  LEFT JOIN agence a ON a.id = c.id_agence`

/**
 * Analytics pipeline — step 0bis (quotidien, en parallèle du job 1).
 * Matérialise ce que les fonctionnalités calculent pour un utilisateur, de
 * façon exhaustive : les jointures et prédicats viennent de sql-helpers (les
 * mêmes que les repositories), rien n'est réécrit ici. Les statuts sont
 * figés à date_calcul.
 * @see docs/ANALYTICS.md#0bis-charger-les-populationsjobts
 * @analytics.trigger ajouterJob depuis DUMP_ANALYTICS, ou TASK_NAME=CHARGER_POPULATIONS_ANALYTICS
 * @analytics.after DUMP_ANALYTICS
 * @analytics.tables_in population, population_conseiller, population_profil, communication, deploiement, conseiller, jeune
 * @analytics.tables_out analytics_population_membres, analytics_communication_destinataires, analytics_deploiement_membres
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
      await this.creerLesTables(connexion)

      const { idsPopulations, conseillers, jeunes } =
        await this.resoudreLesPopulations(connexion)

      volumetrie = await connexion.transaction(async transaction => {
        const ecriture = { dateCalcul: maintenant.toJSDate(), transaction }
        await this.viderLesTables(connexion, transaction)
        await this.ecrireLesConseillers(connexion, conseillers, ecriture)
        await this.ecrireLesJeunes(connexion, jeunes, ecriture)
        return {
          nbPopulations: idsPopulations.length,
          nbConseillers: conseillers.length,
          nbJeunes: jeunes.length,
          nbDestinatairesCommunications:
            await this.ecrireLesDestinatairesDesCommunications(
              connexion,
              ecriture
            ),
          nbMembresDeploiements: await this.ecrireLesMembresDesDeploiements(
            connexion,
            ecriture
          )
        }
      })
      await connexion.close()
    } catch (e) {
      erreur = e
      rootLogger.error(
        {
          context: this.jobType,
          event: {
            action: 'populations_analytics_chargees',
            outcome: 'failure'
          },
          error: toEcsError(e)
        },
        'populations_analytics_chargees'
      )
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

  private async creerLesTables(connexion: Sequelize): Promise<void> {
    await connexion.query(`
      CREATE TABLE IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
      (
        id_population              varchar NOT NULL,
        type_utilisateur           varchar NOT NULL,
        ${COLONNES_UTILISATEUR},
        email_conseiller_reference varchar,
        type_conseiller_reference  varchar,
        date_calcul                timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}_id_population_index
        ON ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME} (id_population);

      CREATE TABLE IF NOT EXISTS ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
      (
        id_communication varchar NOT NULL,
        id_population    varchar NOT NULL,
        destinataire     varchar NOT NULL,
        type             varchar NOT NULL,
        titre            varchar,
        contenu          text,
        date_debut       timestamptz NOT NULL,
        date_fin         timestamptz,
        statut           varchar NOT NULL,
        type_utilisateur varchar NOT NULL,
        ${COLONNES_UTILISATEUR},
        date_calcul      timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}_id_communication_index
        ON ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME} (id_communication);

      CREATE TABLE IF NOT EXISTS ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME}
      (
        id_deploiement    varchar NOT NULL,
        id_population     varchar NOT NULL,
        nature            varchar NOT NULL,
        id_fonctionnalite varchar,
        date_activation   timestamptz NOT NULL,
        statut            varchar NOT NULL,
        type_utilisateur  varchar NOT NULL,
        ${COLONNES_UTILISATEUR},
        date_calcul       timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME}_id_deploiement_index
        ON ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME} (id_deploiement);

      -- CREATE TABLE IF NOT EXISTS n'ajoute pas de colonne à une table déjà créée par un run
      -- précédent : toute colonne ajoutée après la création initiale doit aussi passer ici.
      ALTER TABLE ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS contenu text;
      ALTER TABLE ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS id_agence varchar;
      ALTER TABLE ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS id_agence varchar;
      ALTER TABLE ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS id_agence varchar;
      ALTER TABLE ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
        ALTER COLUMN date_fin DROP NOT NULL;
    `)
  }

  private async viderLesTables(
    connexion: Sequelize,
    transaction: Transaction
  ): Promise<void> {
    await connexion.query(
      `
        DELETE FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};
        DELETE FROM ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME};
        DELETE FROM ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME};
      `,
      { transaction }
    )
  }

  private async resoudreLesPopulations(connexion: Sequelize): Promise<{
    idsPopulations: string[]
    conseillers: Membre[]
    jeunes: Membre[]
  }> {
    const populationRepository = new PopulationSqlRepository(connexion)
    const rows = await connexion.query<{ id: string }>(
      `SELECT id FROM population;`,
      { type: QueryTypes.SELECT }
    )
    const idsPopulations = rows.map(row => row.id)
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
    return { idsPopulations, conseillers, jeunes }
  }

  private async ecrireLesConseillers(
    connexion: Sequelize,
    conseillers: Membre[],
    { dateCalcul, transaction }: Ecriture
  ): Promise<void> {
    if (conseillers.length === 0) return

    await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT m.id_population, 'CONSEILLER', ${SELECT_CONSEILLER},
               NULL, NULL, :dateCalcul
        FROM (VALUES ${sqlValues(conseillers)}) AS m(id_population, id_utilisateur)
        JOIN conseiller c ON c.id = m.id_utilisateur
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { dateCalcul }, transaction }
    )
  }

  private async ecrireLesJeunes(
    connexion: Sequelize,
    jeunes: Membre[],
    { dateCalcul, transaction }: Ecriture
  ): Promise<void> {
    if (jeunes.length === 0) return

    await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT m.id_population, 'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
               COALESCE(j.id_structure_milo, c.id_structure_milo, c.id_agence),
               COALESCE(smj.nom_officiel, sm.nom_officiel, a.nom_agence),
               c.email,
               CASE WHEN j.id_conseiller_initial IS NULL THEN 'ACTUEL' ELSE 'INITIAL' END,
               :dateCalcul
        FROM (VALUES ${sqlValues(jeunes)}) AS m(id_population, id_utilisateur)
        JOIN jeune j ON j.id = m.id_utilisateur
        ${sqlJoinConseillerDeReference('j', 'c')}
        LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { dateCalcul }, transaction }
    )
  }

  private async ecrireLesDestinatairesDesCommunications(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
          (id_communication, id_population, destinataire, type, titre, contenu, date_debut, date_fin, statut,
           type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence, date_calcul)
        SELECT co.id, co.id_population, co.destinataire, co.type, co.titre, co.contenu, co.date_debut, co.date_fin,
               CASE
                 WHEN co.date_fin <= :maintenant THEN 'PASSEE'
                 WHEN ${sqlCommunicationEnCours('co', ':maintenant')} THEN 'EN_COURS'
                 ELSE 'PREVUE'
               END,
               'CONSEILLER', ${SELECT_CONSEILLER}, :maintenant
        FROM communication co
        ${sqlJoinConseillersDestinataires('co', 'c')}
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { maintenant: dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  private async ecrireLesMembresDesDeploiements(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME}
          (id_deploiement, id_population, nature, id_fonctionnalite, date_activation, statut,
           type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence, date_calcul)
        SELECT d.id, d.id_population, d.nature, d.id_fonctionnalite, d.date_activation,
               CASE WHEN ${sqlDeploiementActif('d', ':maintenant')} THEN 'ACTIF' ELSE 'PREVU' END,
               'CONSEILLER', ${SELECT_CONSEILLER}, :maintenant
        FROM deploiement d
        ${sqlJoinConseillersConcernes('d', 'c')}
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { maintenant: dateCalcul }, transaction }
    )
    return nbLignes as number
  }
}

// Identifiants internes lus en base juste avant (jamais une saisie utilisateur) : interpolés tels quels.
function sqlValues(membres: Membre[]): string {
  return membres
    .map(m => `('${m.idPopulation}', '${m.idUtilisateur}')`)
    .join(', ')
}

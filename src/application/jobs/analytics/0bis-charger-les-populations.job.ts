import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Transaction } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { JobHandler } from '../../../building-blocks/types/job-handler'
import { Communication } from '../../../domain/communication'
import { CommunicationEnvoi } from '../../../domain/communication-envoi'
import { Planificateur, ProcessJobType } from '../../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../../domain/suivi-job'
import {
  sqlCommunicationEnCours,
  sqlConseillerDansPopulation,
  sqlDeploiementActif,
  sqlJoinConseillerDeReference,
  sqlJoinConseillersConcernes,
  sqlJoinConseillersDestinataires,
  sqlJoinJeunesDestinataires
} from '../../../infrastructure/repositories/sql-helpers'
import { createSequelizeForAnalytics } from '../../../infrastructure/sequelize/connector-analytics'
import { DateService } from '../../../utils/date-service'
import { rootLogger, toEcsError } from '../../../utils/logger.module'

export const ANALYTICS_POPULATION_MEMBRES_TABLE_NAME =
  'analytics_population_membres'
export const ANALYTICS_COMMUNICATIONS_TABLE_NAME = 'analytics_communications'
export const ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME =
  'analytics_communication_destinataires'
export const ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME =
  'analytics_deploiement_membres'

interface Volumetrie {
  nbPopulations: number
  nbCommunications: number
  nbConseillers: number
  nbJeunes: number
  nbDestinatairesCommunications: number
  nbMembresDeploiements: number
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
 * @analytics.tables_in population, population_conseiller, population_profil, population_structure_milo, population_agence_ft, communication, communication_envoi, deploiement, conseiller, jeune
 * @analytics.tables_out analytics_population_membres, analytics_communications, analytics_communication_destinataires, analytics_deploiement_membres
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

      volumetrie = await connexion.transaction(async transaction => {
        const ecriture = { dateCalcul: maintenant.toJSDate(), transaction }
        await this.viderLesTables(connexion, transaction)
        const nbConseillers = await this.ecrireLesConseillers(
          connexion,
          ecriture
        )
        const nbJeunes = await this.ecrireLesJeunes(connexion, ecriture)
        const nbDestinatairesCommunications =
          await this.ecrireLesDestinatairesDesCommunications(
            connexion,
            ecriture
          )
        return {
          nbPopulations: await this.compterLesPopulations(
            connexion,
            transaction
          ),
          nbCommunications: await this.ecrireLesCommunications(
            connexion,
            ecriture
          ),
          nbConseillers,
          nbJeunes,
          nbDestinatairesCommunications,
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

      CREATE TABLE IF NOT EXISTS ${ANALYTICS_COMMUNICATIONS_TABLE_NAME}
      (
        id_communication    varchar NOT NULL,
        id_population       varchar NOT NULL,
        destinataire        varchar NOT NULL,
        type                varchar NOT NULL,
        push                boolean,
        type_notification   varchar,
        titre               varchar,
        contenu             text,
        cta_label           varchar,
        date_debut          timestamptz NOT NULL,
        date_fin            timestamptz,
        statut              varchar NOT NULL,
        statut_envoi        varchar,
        envoi_termine_le    timestamptz,
        nb_destinataires    integer NOT NULL,
        nb_a_envoyer        integer,
        nb_en_cours         integer,
        nb_envoyees         integer,
        nb_erreurs          integer,
        nb_tokens_invalides integer,
        date_calcul         timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ${ANALYTICS_COMMUNICATIONS_TABLE_NAME}_id_population_index
        ON ${ANALYTICS_COMMUNICATIONS_TABLE_NAME} (id_population);

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
      ALTER TABLE ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS statut_envoi varchar;
      ALTER TABLE ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
        ADD COLUMN IF NOT EXISTS date_traitement_envoi timestamptz;
    `)
  }

  private async viderLesTables(
    connexion: Sequelize,
    transaction: Transaction
  ): Promise<void> {
    await connexion.query(
      `
        DELETE FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};
        DELETE FROM ${ANALYTICS_COMMUNICATIONS_TABLE_NAME};
        DELETE FROM ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME};
        DELETE FROM ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME};
      `,
      { transaction }
    )
  }

  private async compterLesPopulations(
    connexion: Sequelize,
    transaction: Transaction
  ): Promise<number> {
    const rows = await connexion.query<{ nombre: string }>(
      `SELECT count(*) AS nombre FROM population;`,
      { type: QueryTypes.SELECT, transaction }
    )
    return Number(rows[0].nombre)
  }

  private async ecrireLesConseillers(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT p.id, 'CONSEILLER', ${SELECT_CONSEILLER},
               NULL, NULL, :dateCalcul
        FROM population p
        JOIN conseiller c ON ${sqlConseillerDansPopulation('c', 'p.id')}
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  private async ecrireLesJeunes(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence,
           email_conseiller_reference, type_conseiller_reference, date_calcul)
        SELECT p.id, 'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
               COALESCE(j.id_structure_milo, c.id_structure_milo, c.id_agence),
               COALESCE(smj.nom_officiel, sm.nom_officiel, a.nom_agence),
               c.email,
               CASE WHEN j.id_conseiller_initial IS NULL THEN 'ACTUEL' ELSE 'INITIAL' END,
               :dateCalcul
        FROM population p
        CROSS JOIN jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
          AND ${sqlConseillerDansPopulation('c', 'p.id')}
        LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  private async ecrireLesDestinatairesDesCommunications(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const nbConseillers = await this.ecrireLesConseillersDestinataires(
      connexion,
      dateCalcul,
      transaction
    )
    const nbJeunes = await this.ecrireLesJeunesDestinataires(
      connexion,
      dateCalcul,
      transaction
    )
    const nbJeunesNotifies = await this.ecrireLesJeunesNotifies(
      connexion,
      dateCalcul,
      transaction
    )
    return nbConseillers + nbJeunes + nbJeunesNotifies
  }

  private async ecrireLesConseillersDestinataires(
    connexion: Sequelize,
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
          (id_communication, id_population, destinataire, type, titre, contenu, date_debut, date_fin, statut,
           type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence, date_calcul)
        SELECT co.id, co.id_population, co.destinataire, co.type, co.titre, co.contenu, co.date_debut, co.date_fin,
               ${sqlStatutCommunication('co')},
               'CONSEILLER', ${SELECT_CONSEILLER}, :maintenant
        FROM communication co
        ${sqlJoinConseillersDestinataires('co', 'c')}
        ${JOIN_LIEU_CONSEILLER};
      `,
      { replacements: { maintenant: dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  private async ecrireLesJeunesDestinataires(
    connexion: Sequelize,
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
          (id_communication, id_population, destinataire, type, titre, contenu, date_debut, date_fin, statut,
           type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence, date_calcul)
        SELECT co.id, co.id_population, co.destinataire, co.type, co.titre, co.contenu, co.date_debut, co.date_fin,
               ${sqlStatutCommunication('co')},
               'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
               COALESCE(j.id_structure_milo, c.id_structure_milo, c.id_agence),
               COALESCE(smj.nom_officiel, sm.nom_officiel, a.nom_agence),
               :maintenant
        FROM communication co
        JOIN jeune j ON co.destinataire = '${Communication.Destinataire.JEUNE}'
        ${sqlJoinJeunesDestinataires('j', 'c', {
          idPopulation: 'co.id_population',
          push: 'co.push'
        })}
        LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
        ${JOIN_LIEU_CONSEILLER}
        WHERE ${sqlEnvoiNonDemarre('co')};
      `,
      { replacements: { maintenant: dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  // Envoi démarré : la population a été figée dans communication_envoi, c'est elle
  // qui fait foi, même si le jeune a changé de profil ou de conseiller depuis.
  private async ecrireLesJeunesNotifies(
    connexion: Sequelize,
    dateCalcul: Date,
    transaction: Transaction
  ): Promise<number> {
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
          (id_communication, id_population, destinataire, type, titre, contenu, date_debut, date_fin, statut,
           type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, id_agence, agence,
           statut_envoi, date_traitement_envoi, date_calcul)
        SELECT co.id, co.id_population, co.destinataire, co.type, co.titre, co.contenu, co.date_debut, co.date_fin,
               ${sqlStatutCommunication('co')},
               'JEUNE', j.id, j.email, j.nom, j.prenom, j.structure, j.dispositif,
               COALESCE(j.id_structure_milo, c.id_structure_milo, c.id_agence),
               COALESCE(smj.nom_officiel, sm.nom_officiel, a.nom_agence),
               ce.statut, ce.date_traitement,
               :maintenant
        FROM communication co
        JOIN communication_envoi ce ON ce.id_communication = co.id
        JOIN jeune j ON j.id = ce.id_jeune
        LEFT JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
        LEFT JOIN structure_milo smj ON smj.id = j.id_structure_milo
        ${JOIN_LIEU_CONSEILLER}
        WHERE NOT ${sqlEnvoiNonDemarre('co')};
      `,
      { replacements: { maintenant: dateCalcul }, transaction }
    )
    return nbLignes as number
  }

  // Les compteurs figés à la fin de l'envoi priment : communication_envoi est purgé
  // 30 jours après (NETTOYER_LES_DONNEES), il ne reste alors plus qu'eux.
  private async ecrireLesCommunications(
    connexion: Sequelize,
    { dateCalcul, transaction }: Ecriture
  ): Promise<number> {
    const nbEnvoisAuStatut = (statut: CommunicationEnvoi.Statut): string =>
      `count(*) FILTER (WHERE statut = '${statut}')`
    const [, nbLignes] = await connexion.query(
      `
        INSERT INTO ${ANALYTICS_COMMUNICATIONS_TABLE_NAME}
          (id_communication, id_population, destinataire, type, push, type_notification, titre, contenu, cta_label,
           date_debut, date_fin, statut, statut_envoi, envoi_termine_le,
           nb_destinataires, nb_a_envoyer, nb_en_cours, nb_envoyees, nb_erreurs, nb_tokens_invalides, date_calcul)
        SELECT co.id, co.id_population, co.destinataire, co.type, co.push, co.type_notification, co.titre, co.contenu,
               co.cta_label, co.date_debut, co.date_fin, ${sqlStatutCommunication('co')},
               co.statut_envoi, co.envoi_termine_le,
               GREATEST(COALESCE(d.nb_destinataires, 0), co.nb_envoyees + co.nb_erreurs + co.nb_tokens_invalides),
               e.nb_a_envoyer, e.nb_en_cours,
               COALESCE(co.nb_envoyees, e.nb_envoyees),
               COALESCE(co.nb_erreurs, e.nb_erreurs),
               COALESCE(co.nb_tokens_invalides, e.nb_tokens_invalides),
               :maintenant
        FROM communication co
        LEFT JOIN (
          SELECT id_communication, count(*) AS nb_destinataires
          FROM ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME}
          GROUP BY id_communication
        ) d ON d.id_communication = co.id::varchar
        LEFT JOIN (
          SELECT id_communication,
                 ${nbEnvoisAuStatut(CommunicationEnvoi.Statut.A_ENVOYER)} AS nb_a_envoyer,
                 ${nbEnvoisAuStatut(CommunicationEnvoi.Statut.EN_COURS)} AS nb_en_cours,
                 ${nbEnvoisAuStatut(CommunicationEnvoi.Statut.ENVOYEE)} AS nb_envoyees,
                 ${nbEnvoisAuStatut(CommunicationEnvoi.Statut.ERREUR)} AS nb_erreurs,
                 ${nbEnvoisAuStatut(CommunicationEnvoi.Statut.TOKEN_INVALIDE)} AS nb_tokens_invalides
          FROM communication_envoi
          GROUP BY id_communication
        ) e ON e.id_communication = co.id;
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

// Une NOTIFICATION n'a pas de date_fin : envoi ponctuel, passée dès sa date_debut.
function sqlStatutCommunication(aliasCom: string): string {
  return `
    CASE
      WHEN ${aliasCom}.date_fin <= :maintenant THEN 'PASSEE'
      WHEN ${aliasCom}.type = '${Communication.Type.NOTIFICATION}' AND ${aliasCom}.date_debut <= :maintenant THEN 'PASSEE'
      WHEN ${sqlCommunicationEnCours(aliasCom, ':maintenant')} THEN 'EN_COURS'
      ELSE 'PREVUE'
    END`
}

// Tant que l'envoi n'a pas démarré (ou pour un bandeau, sans envoi), la population
// n'est pas figée : les destinataires sont ceux qu'elle résout à date_calcul.
function sqlEnvoiNonDemarre(aliasCom: string): string {
  return `(${aliasCom}.statut_envoi IS NULL OR ${aliasCom}.statut_envoi = '${Communication.StatutEnvoi.A_ENVOYER}')`
}

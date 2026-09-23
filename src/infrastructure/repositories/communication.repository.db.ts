import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize'
import { Communication } from '../../domain/communication'
import { CommunicationEnvoi } from '../../domain/communication-envoi'
import { CommunicationEnvoiSqlModel } from '../sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../sequelize/models/communication.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReference,
  sqlJoinConseillerDeReferenceDuJeune,
  sqlJoinConseillersDestinataires
} from './sql-helpers'

@Injectable()
export class CommunicationSqlRepository implements Communication.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getMessageInformatifDuConseiller(
    idConseiller: string,
    maintenant: DateTime
  ): Promise<Communication.MessageInformatif | undefined> {
    const rows = await this.sequelize.query<{
      id: number
      titre: string
      contenu: string
    }>(
      `
        SELECT co.id, co.titre, co.contenu
        FROM communication co
        ${sqlJoinConseillersDestinataires('co', 'c')}
        WHERE c.id = :idConseiller
          AND co.type = :type
          AND co.date_debut <= :maintenant
          AND (co.date_fin IS NULL OR :maintenant < co.date_fin)
        ORDER BY co.date_fin ASC NULLS LAST
        LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          type: Communication.Type.IN_APP,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows[0]
  }

  async getMessageInformatifDuJeune(
    idJeune: string,
    maintenant: DateTime
  ): Promise<Communication.MessageInformatifJeune | undefined> {
    const rows = await this.sequelize.query<{
      id: number
      titre: string
      contenu: string
      cta_label: string | null
      cta_url_android: string | null
      cta_url_ios: string | null
    }>(
      `
        SELECT co.id, co.titre, co.contenu, co.cta_label, co.cta_url_android, co.cta_url_ios
        FROM communication co
        ${sqlJoinConseillerDeReferenceDuJeune()}
        WHERE co.destinataire = :destinataire
          AND co.type = :type
          AND co.date_debut <= :maintenant
          AND (co.date_fin IS NULL OR :maintenant < co.date_fin)
          AND ${sqlJeuneDansPopulation('j', 'c', 'co.id_population')}
        ORDER BY co.date_fin ASC NULLS LAST
        LIMIT 1
      `,
      {
        replacements: {
          idJeune,
          destinataire: Communication.Destinataire.JEUNE,
          type: Communication.Type.IN_APP,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    const row = rows[0]
    if (!row) return undefined

    const message: Communication.MessageInformatifJeune = {
      id: row.id,
      titre: row.titre,
      contenu: row.contenu
    }
    if (row.cta_label && row.cta_url_android && row.cta_url_ios) {
      message.cta = {
        label: row.cta_label,
        urlAndroid: row.cta_url_android,
        urlIos: row.cta_url_ios
      }
    }
    return message
  }

  async recupererEnvoiEnCours(): Promise<Communication.AEnvoyer | undefined> {
    const communication = await CommunicationSqlModel.findOne({
      where: { statutEnvoi: Communication.StatutEnvoi.EN_COURS },
      order: [['dateDebut', 'ASC']]
    })
    return communication ? toAEnvoyer(communication) : undefined
  }

  async demarrerProchainEnvoi(
    maintenant: DateTime
  ): Promise<Communication.AEnvoyer | undefined> {
    return this.sequelize.transaction(async transaction => {
      const reclamees = await this.sequelize.query<{ id: number }>(
        `
          UPDATE communication SET statut_envoi = :enCours
          WHERE id = (
            SELECT id FROM communication
            WHERE type = :type AND statut_envoi = :aEnvoyer
              AND destinataire = :destinataire AND push IS NOT NULL
              AND date_debut <= :maintenant
              AND NOT EXISTS (
                SELECT 1 FROM communication WHERE statut_envoi = :enCours
              )
            ORDER BY date_debut ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id
        `,
        {
          replacements: {
            enCours: Communication.StatutEnvoi.EN_COURS,
            aEnvoyer: Communication.StatutEnvoi.A_ENVOYER,
            type: Communication.Type.NOTIFICATION,
            destinataire: Communication.Destinataire.JEUNE,
            maintenant: maintenant.toJSDate()
          },
          type: QueryTypes.SELECT,
          transaction
        }
      )
      const reclamee = reclamees[0]
      if (!reclamee) return undefined

      const communication = (await CommunicationSqlModel.findByPk(reclamee.id, {
        transaction
      }))!
      await this.figerPopulation(communication, transaction)
      return toAEnvoyer(communication)
    })
  }

  private async figerPopulation(
    communication: CommunicationSqlModel,
    transaction: Transaction
  ): Promise<void> {
    await this.sequelize.query(
      `
        INSERT INTO communication_envoi (id_communication, id_jeune, statut)
        SELECT :idCommunication, j.id, :aEnvoyer
        ${sqlDestinatairesDeLaPopulation(communication.push!)}
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          idCommunication: communication.id,
          idPopulation: communication.idPopulation,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER
        },
        type: QueryTypes.INSERT,
        transaction
      }
    )
  }

  async libererEnvoisBloques(
    idCommunication: number,
    avant: DateTime
  ): Promise<number> {
    const [nombre] = await CommunicationEnvoiSqlModel.update(
      { statut: CommunicationEnvoi.Statut.A_ENVOYER, dateTraitement: null },
      {
        where: {
          idCommunication,
          statut: CommunicationEnvoi.Statut.EN_COURS,
          dateTraitement: { [Op.lt]: avant.toJSDate() }
        }
      }
    )
    return nombre
  }

  async reserverEnvois(
    idCommunication: number,
    nombre: number,
    maintenant: DateTime
  ): Promise<Array<{ idJeune: string; token: string | null }>> {
    const rows = await this.sequelize.query<{
      id_jeune: string
      push_notification_token: string | null
    }>(
      `
        WITH reserves AS (
          UPDATE communication_envoi ce SET statut = :enCours, date_traitement = :maintenant
          WHERE (ce.id_communication, ce.id_jeune) IN (
            SELECT id_communication, id_jeune FROM communication_envoi
            WHERE id_communication = :idCommunication AND statut = :aEnvoyer
            ORDER BY id_jeune
            LIMIT :nombre
            FOR UPDATE SKIP LOCKED
          )
          RETURNING ce.id_jeune
        )
        SELECT r.id_jeune, j.push_notification_token
        FROM reserves r JOIN jeune j ON j.id = r.id_jeune
        ORDER BY r.id_jeune
      `,
      {
        replacements: {
          idCommunication,
          nombre,
          enCours: CommunicationEnvoi.Statut.EN_COURS,
          aEnvoyer: CommunicationEnvoi.Statut.A_ENVOYER,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => ({
      idJeune: row.id_jeune,
      token: row.push_notification_token
    }))
  }

  async marquerEnvoi(
    idCommunication: number,
    idJeune: string,
    statut: CommunicationEnvoi.Statut,
    maintenant: DateTime
  ): Promise<void> {
    await CommunicationEnvoiSqlModel.update(
      { statut, dateTraitement: maintenant.toJSDate() },
      {
        where: {
          idCommunication,
          idJeune,
          statut: CommunicationEnvoi.Statut.EN_COURS
        }
      }
    )
  }

  async rendreEnvois(
    idCommunication: number,
    idsJeunes: string[]
  ): Promise<void> {
    if (idsJeunes.length === 0) return
    await CommunicationEnvoiSqlModel.update(
      { statut: CommunicationEnvoi.Statut.A_ENVOYER, dateTraitement: null },
      {
        where: {
          idCommunication,
          idJeune: idsJeunes,
          statut: CommunicationEnvoi.Statut.EN_COURS
        }
      }
    )
  }

  async compterEnvois(
    idCommunication: number
  ): Promise<CommunicationEnvoi.Compteurs> {
    const rows = await this.sequelize.query<{
      statut: CommunicationEnvoi.Statut
      nombre: string
    }>(
      `
        SELECT statut, count(*) AS nombre
        FROM communication_envoi
        WHERE id_communication = :idCommunication
        GROUP BY statut
      `,
      { replacements: { idCommunication }, type: QueryTypes.SELECT }
    )
    const parStatut = new Map(rows.map(row => [row.statut, Number(row.nombre)]))
    const compter = (statut: CommunicationEnvoi.Statut): number =>
      parStatut.get(statut) ?? 0
    return {
      aEnvoyer: compter(CommunicationEnvoi.Statut.A_ENVOYER),
      enCours: compter(CommunicationEnvoi.Statut.EN_COURS),
      envoyees: compter(CommunicationEnvoi.Statut.ENVOYEE),
      erreurs: compter(CommunicationEnvoi.Statut.ERREUR),
      tokensInvalides: compter(CommunicationEnvoi.Statut.TOKEN_INVALIDE)
    }
  }

  async enregistrerEchecDeLot(idCommunication: number): Promise<number> {
    const rows = await this.sequelize.query<{ echecs_consecutifs: number }>(
      `
        UPDATE communication SET echecs_consecutifs = echecs_consecutifs + 1
        WHERE id = :idCommunication
        RETURNING echecs_consecutifs
      `,
      { replacements: { idCommunication }, type: QueryTypes.SELECT }
    )
    return rows[0].echecs_consecutifs
  }

  async reinitialiserEchecsDeLot(idCommunication: number): Promise<void> {
    await CommunicationSqlModel.update(
      { echecsConsecutifs: 0 },
      { where: { id: idCommunication } }
    )
  }

  async terminerEnvoi(
    idCommunication: number,
    statut:
      | Communication.StatutEnvoi.ENVOYEE
      | Communication.StatutEnvoi.ANNULEE
      | Communication.StatutEnvoi.EN_ERREUR,
    maintenant: DateTime
  ): Promise<void> {
    const nbEnvoisAuStatut = (statutEnvoi: string): string =>
      `(SELECT count(*) FROM communication_envoi WHERE id_communication = :idCommunication AND statut = ${statutEnvoi})`
    await this.sequelize.query(
      `
        UPDATE communication SET
          statut_envoi = :statut,
          envoi_termine_le = :maintenant,
          nb_envoyees = ${nbEnvoisAuStatut(':envoyee')},
          nb_erreurs = ${nbEnvoisAuStatut(':erreur')},
          nb_tokens_invalides = ${nbEnvoisAuStatut(':tokenInvalide')}
        WHERE id = :idCommunication AND statut_envoi = :enCours
      `,
      {
        replacements: {
          idCommunication,
          statut,
          maintenant: maintenant.toJSDate(),
          enCours: Communication.StatutEnvoi.EN_COURS,
          envoyee: CommunicationEnvoi.Statut.ENVOYEE,
          erreur: CommunicationEnvoi.Statut.ERREUR,
          tokenInvalide: CommunicationEnvoi.Statut.TOKEN_INVALIDE
        },
        type: QueryTypes.UPDATE
      }
    )
  }

  async compterDestinataires(
    idPopulation: string,
    push: boolean
  ): Promise<number> {
    const rows = await this.sequelize.query<{ nombre: string }>(
      `
        SELECT count(*) AS nombre
        ${sqlDestinatairesDeLaPopulation(push)}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return Number(rows[0].nombre)
  }
}

// Le SQL retourné référence :idPopulation — l'appelant doit le fournir dans replacements.
function sqlDestinatairesDeLaPopulation(push: boolean): string {
  const filtreToken = push ? 'AND j.push_notification_token IS NOT NULL' : ''
  return `
    FROM jeune j
    ${sqlJoinConseillerDeReference('j', 'c')}
    WHERE ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
    ${filtreToken}`
}

function toAEnvoyer(
  communication: CommunicationSqlModel
): Communication.AEnvoyer {
  return {
    id: communication.id,
    idPopulation: communication.idPopulation,
    titre: communication.titre,
    contenu: communication.contenu,
    typeNotification: communication.typeNotification ?? undefined,
    push: communication.push!,
    echecsConsecutifs: communication.echecsConsecutifs
  }
}

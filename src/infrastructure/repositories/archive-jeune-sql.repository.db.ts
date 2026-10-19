import { Injectable } from '@nestjs/common'
import { Op } from 'sequelize'
import { MauvaiseCommandeError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Action } from '../../domain/action/action'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { FirebaseClient } from '../clients/firebase-client'
import { ActionSqlModel } from '../sequelize/models/action.sql-model'
import {
  ArchiveJeuneDto,
  ArchiveJeuneSqlModel
} from '../sequelize/models/archive-jeune.sql-model'
import { CommentaireSqlModel } from '../sequelize/models/commentaire.sql-model'
import { ConseillerSqlModel } from '../sequelize/models/conseiller.sql-model'
import { FavoriOffreEmploiSqlModel } from '../sequelize/models/favori-offre-emploi.sql-model'
import { FavoriOffreEngagementSqlModel } from '../sequelize/models/favori-offre-engagement.sql-model'
import { FavoriOffreImmersionSqlModel } from '../sequelize/models/favori-offre-immersion.sql-model'
import { JeuneSqlModel } from '../sequelize/models/jeune.sql-model'
import { RechercheSqlModel } from '../sequelize/models/recherche.sql-model'
import { RendezVousSqlModel } from '../sequelize/models/rendez-vous.sql-model'
import { TransfertConseillerSqlModel } from '../sequelize/models/transfert-conseiller.sql-model'
import { AsSql } from '../sequelize/types'
import { toFavoriOffreEmploi } from './mappers/offres-emploi.mappers'
import { fromSqlToFavorisOffreImmersion } from './mappers/offres-immersion.mappers'
import { fromSqlToRecherche } from './mappers/recherches.mappers'
import { sqlToOffreServiceCivique } from './mappers/service-civique.mapper'

@Injectable()
export class ArchiveJeuneSqlRepository implements ArchiveJeune.Repository {
  constructor(private firebaseClient: FirebaseClient) {}

  async archiver(metadonnees: ArchiveJeune.Metadonnees): Promise<Result> {
    const [archive] = await this.construireArchives([metadonnees])
    if (!archive) {
      return failure(new MauvaiseCommandeError('Jeune déjà supprimé'))
    }
    await ArchiveJeuneSqlModel.creer(versLigneArchive(archive))
    return emptySuccess()
  }

  async construireArchives(
    metadonnees: ArchiveJeune.Metadonnees[]
  ): Promise<ArchiveJeune.ArchiveConstruite[]> {
    if (!metadonnees.length) return []
    const idsJeunes = metadonnees.map(({ idJeune }) => idJeune)

    const jeunesSql = await JeuneSqlModel.findAll({
      where: { id: { [Op.in]: idsJeunes } },
      include: [
        ConseillerSqlModel,
        {
          model: TransfertConseillerSqlModel,
          include: [
            {
              as: 'conseillerSource',
              model: ConseillerSqlModel
            },
            {
              as: 'conseillerCible',
              model: ConseillerSqlModel
            }
          ]
        }
      ]
    })
    const rdvs = await RendezVousSqlModel.findAll({
      include: [
        {
          model: JeuneSqlModel,
          where: { id: { [Op.in]: idsJeunes } },
          include: [ConseillerSqlModel]
        }
      ]
    })
    const actions = await ActionSqlModel.findAll({
      include: [
        {
          model: CommentaireSqlModel
        }
      ],
      where: { idJeune: { [Op.in]: idsJeunes } }
    })
    const favorisOffreEmploi = await FavoriOffreEmploiSqlModel.findAll({
      where: { idJeune: { [Op.in]: idsJeunes } }
    })
    const favorisOffreImmersion = await FavoriOffreImmersionSqlModel.findAll({
      where: { idJeune: { [Op.in]: idsJeunes } }
    })
    const favorisOffreEngagement = await FavoriOffreEngagementSqlModel.findAll({
      where: { idJeune: { [Op.in]: idsJeunes } }
    })
    const recherches = await RechercheSqlModel.findAll({
      where: { idJeune: { [Op.in]: idsJeunes } }
    })

    const archives: ArchiveJeune.ArchiveConstruite[] = []
    for (const metadonneesJeune of metadonnees) {
      const idJeune = metadonneesJeune.idJeune
      const jeuneSql = jeunesSql.find(({ id }) => id === idJeune)
      if (!jeuneSql) continue

      const messages = await this.firebaseClient.getChatAArchiver(idJeune)
      archives.push({
        metadonnees: metadonneesJeune,
        idStructureMilo: jeuneSql.idStructureMilo ?? null,
        donnees: this.mapToArchiveJeune(
          jeuneSql,
          metadonneesJeune,
          rdvs.filter(rdv => rdv.jeunes.some(({ id }) => id === idJeune)),
          actions.filter(action => action.idJeune === idJeune),
          favorisOffreEmploi.filter(favori => favori.idJeune === idJeune),
          favorisOffreImmersion.filter(favori => favori.idJeune === idJeune),
          favorisOffreEngagement.filter(favori => favori.idJeune === idJeune),
          recherches.filter(recherche => recherche.idJeune === idJeune),
          messages
        )
      })
    }
    return archives
  }

  async enregistrerArchives(
    archives: ArchiveJeune.ArchiveConstruite[]
  ): Promise<void> {
    if (!archives.length) return
    await ArchiveJeuneSqlModel.bulkCreate(archives.map(versLigneArchive))
  }

  async archiverSansDonnees(
    metadonnees: ArchiveJeune.Metadonnees
  ): Promise<Result> {
    const jeuneSqlModel = await JeuneSqlModel.findByPk(metadonnees.idJeune, {
      attributes: ['idStructureMilo']
    })
    const donneesVides: ArchiveJeune = {
      rendezVous: [],
      actions: [],
      favoris: {
        offresEmploi: [],
        offresImmersions: [],
        offresServiceCivique: []
      },
      recherches: [],
      dernierConseiller: { nom: '', prenom: '' },
      historiqueConseillers: [],
      messages: []
    }
    await ArchiveJeuneSqlModel.creer(
      versLigneArchive({
        metadonnees,
        idStructureMilo: jeuneSqlModel?.idStructureMilo ?? null,
        donnees: donneesVides
      })
    )
    return emptySuccess()
  }

  async findById(idArchive: number): Promise<boolean> {
    const archive = await ArchiveJeuneSqlModel.findByPk(idArchive, {
      attributes: ['id']
    })
    return !!archive
  }

  async delete(idArchive: number): Promise<void> {
    await ArchiveJeuneSqlModel.destroy({
      where: {
        id: idArchive
      }
    })
  }

  async getIdsArchivesBefore(date: Date): Promise<number[]> {
    const archivesSql = await ArchiveJeuneSqlModel.findAll({
      attributes: ['id'],
      where: {
        dateArchivage: {
          [Op.lte]: date
        }
      }
    })

    return archivesSql.map(archive => archive.id)
  }

  async trouverArchiveAvecMotif(
    emailJeune: string,
    motif: ArchiveJeune.MotifSuppression | ArchiveJeune.MotifSuppressionSupport
  ): Promise<ArchiveJeune.ArchiveMigration | undefined> {
    const archiveSql = await ArchiveJeuneSqlModel.findOne({
      attributes: ['idPopulation'],
      where: {
        email: {
          [Op.eq]: emailJeune
        },
        motif: {
          [Op.eq]: motif
        }
      },
      order: [['dateArchivage', 'DESC']]
    })
    if (!archiveSql) return undefined
    return { idPopulation: archiveSql.idPopulation }
  }

  private mapToArchiveJeune(
    jeuneSqlModel: JeuneSqlModel,
    metadonnes: ArchiveJeune.Metadonnees,
    rdv: RendezVousSqlModel[],
    actions: ActionSqlModel[],
    favorisOffreEmploi: FavoriOffreEmploiSqlModel[],
    favorisOffreImmersion: FavoriOffreImmersionSqlModel[],
    favorisOffreEngagement: FavoriOffreEngagementSqlModel[],
    recherches: RechercheSqlModel[],
    messages: ArchiveJeune.Message[]
  ): ArchiveJeune {
    return {
      rendezVous: rdv.map(this.toRendezVousArchive),
      actions: this.fromActionSqlToActionArchive(actions, metadonnes),
      favoris: {
        offresEmploi: favorisOffreEmploi.map(toFavoriOffreEmploi),
        offresImmersions: favorisOffreImmersion.map(
          fromSqlToFavorisOffreImmersion
        ),
        offresServiceCivique: favorisOffreEngagement.map(
          sqlToOffreServiceCivique
        )
      },
      recherches: recherches.map(fromSqlToRecherche),
      dernierConseiller: {
        nom: jeuneSqlModel.conseiller?.nom || '',
        prenom: jeuneSqlModel.conseiller?.prenom || ''
      },
      historiqueConseillers:
        jeuneSqlModel.transferts?.map(transfertSql => ({
          conseillerSource: {
            prenom: transfertSql.conseillerSource.prenom,
            nom: transfertSql.conseillerSource.nom
          },
          conseillerCible: {
            prenom: transfertSql.conseillerCible.prenom,
            nom: transfertSql.conseillerCible.nom
          },
          dateDeTransfert: transfertSql.dateTransfert
        })) ?? [],
      messages
    }
  }

  private toRendezVousArchive(
    rdvSql: RendezVousSqlModel
  ): ArchiveJeune.RendezVous {
    return {
      titre: rdvSql.titre,
      sousTitre: rdvSql.sousTitre,
      commentaire: rdvSql.commentaire || undefined,
      modalite: rdvSql.modalite || undefined,
      date: rdvSql.date,
      duree: rdvSql.duree,
      type: rdvSql.type,
      precision: rdvSql.precision || undefined,
      adresse: rdvSql.adresse || undefined,
      organisme: rdvSql.organisme || undefined,
      presenceConseiller: Boolean(rdvSql.presenceConseiller)
    }
  }

  private fromActionSqlToActionArchive(
    actions: ActionSqlModel[],
    metadonnes: ArchiveJeune.Metadonnees
  ): ArchiveJeune.Action[] {
    return actions.map((actionSql): ArchiveJeune.Action => ({
      description: actionSql.description || '',
      contenu: actionSql.contenu || '',
      statut: actionSql.statut || '',
      dateCreation: actionSql.dateCreation,
      creePar:
        actionSql.idCreateur === metadonnes.idJeune ? 'JEUNE' : 'CONSEILLER',
      dateActualisation: actionSql.dateDerniereActualisation,
      dateEcheance: actionSql.dateEcheance ?? undefined,
      commentaires: actionSql.commentaires.map(commentaireSql => {
        return {
          date: commentaireSql.date,
          message: commentaireSql.message,
          creePar:
            commentaireSql.createur.type === Action.TypeCreateur.JEUNE
              ? 'JEUNE'
              : 'CONSEILLER'
        }
      })
    }))
  }
}

function versLigneArchive({
  metadonnees,
  idStructureMilo,
  donnees
}: ArchiveJeune.ArchiveConstruite): AsSql<Omit<ArchiveJeuneDto, 'id'>> {
  return {
    idJeune: metadonnees.idJeune,
    email: metadonnees.email ?? null,
    prenom: metadonnees.prenomJeune,
    nom: metadonnees.nomJeune,
    structure: metadonnees.structure,
    dispositif: metadonnees.dispositif ?? null,
    idPopulation: metadonnees.idPopulation ?? null,
    idPartenaire: metadonnees.idPartenaire ?? null,
    dateCreation: metadonnees.dateCreation,
    datePremiereConnexion: metadonnees.datePremiereConnexion ?? null,
    dateFinAccompagnement: metadonnees.dateFinAccompagnement ?? null,
    motif: metadonnees.motif,
    commentaire: metadonnees.commentaire ?? null,
    dateArchivage: metadonnees.dateArchivage,
    idStructureMilo,
    donnees
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Sequelize } from 'sequelize'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Action } from '../../../domain/action/action'
import { ArchiveJeune } from '../../../domain/archive-jeune'
import { Chat, ChatRepositoryToken } from '../../../domain/chat'
import { Core } from '../../../domain/core'
import { Jeune } from '../../../domain/jeune/jeune'
import { Profil } from '../../../domain/profil'
import {
  RendezVous,
  TYPES_ANIMATIONS_COLLECTIVES
} from '../../../domain/rendez-vous/rendez-vous'
import {
  ActionDto,
  ActionSqlModel
} from '../../../infrastructure/sequelize/models/action.sql-model'
import { ArchiveJeuneSqlModel } from '../../../infrastructure/sequelize/models/archive-jeune.sql-model'
import { CommentaireSqlModel } from '../../../infrastructure/sequelize/models/commentaire.sql-model'
import { ConseillerSqlModel } from '../../../infrastructure/sequelize/models/conseiller.sql-model'
import { FavoriOffreEmploiSqlModel } from '../../../infrastructure/sequelize/models/favori-offre-emploi.sql-model'
import { FavoriOffreEngagementSqlModel } from '../../../infrastructure/sequelize/models/favori-offre-engagement.sql-model'
import { FavoriOffreImmersionSqlModel } from '../../../infrastructure/sequelize/models/favori-offre-immersion.sql-model'
import {
  JeuneDto,
  JeuneSqlModel
} from '../../../infrastructure/sequelize/models/jeune.sql-model'
import { RechercheSqlModel } from '../../../infrastructure/sequelize/models/recherche.sql-model'
import { RendezVousJeuneAssociationSqlModel } from '../../../infrastructure/sequelize/models/rendez-vous-jeune-association.sql-model'
import {
  RendezVousDto,
  RendezVousSqlModel
} from '../../../infrastructure/sequelize/models/rendez-vous.sql-model'
import { StructureMiloSqlModel } from '../../../infrastructure/sequelize/models/structure-milo.sql-model'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'
import { AsSql } from '../../../infrastructure/sequelize/types'
import { IdService } from '../../../utils/id-service'

export interface DesarchiverJeuneCommand extends Command {
  idArchive: number
  idConseiller: string
}

export class DesarchivageJeuneQueryModel {
  @ApiProperty()
  idJeune: string

  @ApiProperty({
    description:
      "false si l'archive ne contenait pas d'email : le jeune ne pourra pas être réassocié à son compte à la prochaine connexion"
  })
  emailRestaure: boolean

  @ApiProperty()
  actionsRestaurees: number

  @ApiProperty()
  rendezVousRestaures: number

  @ApiProperty({
    description:
      'Animations collectives non restaurées (toujours existantes en base mais inscription du jeune perdue)'
  })
  animationsCollectivesNonRestaurees: number

  @ApiProperty()
  favorisRestaures: number

  @ApiProperty()
  recherchesRestaurees: number

  @ApiProperty({
    description:
      "Messages du chat réinjectés dans Firebase (texte et historique d'édition uniquement : pièces jointes, offres liées et statuts de lecture perdus). 0 si la restauration du chat a échoué (voir les logs)."
  })
  messagesRestaures: number
}

@Injectable()
export class DesarchiverJeuneCommandHandler extends CommandHandler<
  DesarchiverJeuneCommand,
  DesarchivageJeuneQueryModel
> {
  readonly profilsAutorises = [Profil.Support.SUPPORT]

  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(ChatRepositoryToken)
    private readonly chatRepository: Chat.Repository,
    private readonly idService: IdService
  ) {
    super('DesarchiverJeuneCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: DesarchiverJeuneCommand
  ): Promise<Result<DesarchivageJeuneQueryModel>> {
    const archive = await ArchiveJeuneSqlModel.findByPk(command.idArchive)
    if (!archive) {
      return failure(
        new NonTrouveError('ArchiveJeune', String(command.idArchive))
      )
    }
    if (!archive.structure) {
      return failure(
        new MauvaiseCommandeError(
          "L'archive ne contient pas la structure du jeune"
        )
      )
    }

    const jeuneExistant = await JeuneSqlModel.findByPk(archive.idJeune, {
      attributes: ['id']
    })
    if (jeuneExistant) {
      return failure(
        new MauvaiseCommandeError(
          `Le jeune ${archive.idJeune} existe déjà en base`
        )
      )
    }

    const conseiller = await ConseillerSqlModel.findByPk(command.idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    const structureMiloExistante = archive.idStructureMilo
      ? await StructureMiloSqlModel.findByPk(archive.idStructureMilo, {
          attributes: ['id']
        })
      : null

    const donnees = archive.donnees
    const rendezVousARestaurer =
      donnees?.rendezVous.filter(
        rdv => !TYPES_ANIMATIONS_COLLECTIVES.includes(rdv.type)
      ) ?? []
    const nombreFavoris = donnees
      ? donnees.favoris.offresEmploi.length +
        donnees.favoris.offresImmersions.length +
        donnees.favoris.offresServiceCivique.length
      : 0

    await this.sequelize.transaction(async transaction => {
      await JeuneSqlModel.create(
        this.construireJeune(
          archive,
          conseiller.id,
          structureMiloExistante ? archive.idStructureMilo : null
        ),
        { transaction }
      )

      if (!donnees) {
        return
      }

      for (const action of donnees.actions) {
        const idAction = this.idService.uuid()
        await ActionSqlModel.create(
          this.construireAction(idAction, action, archive, conseiller),
          { transaction }
        )
        for (const commentaire of action.commentaires ?? []) {
          await CommentaireSqlModel.create(
            {
              id: this.idService.uuid(),
              idAction,
              date: commentaire.date,
              message: commentaire.message,
              createur: this.construireCreateur(
                commentaire.creePar,
                archive,
                conseiller
              )
            },
            { transaction }
          )
        }
      }

      for (const rendezVous of rendezVousARestaurer) {
        const idRendezVous = this.idService.uuid()
        await RendezVousSqlModel.create(
          this.construireRendezVous(idRendezVous, rendezVous, conseiller),
          { transaction }
        )
        await RendezVousJeuneAssociationSqlModel.create(
          { idRendezVous, idJeune: archive.idJeune, present: null },
          { transaction }
        )
      }

      await FavoriOffreEmploiSqlModel.bulkCreate(
        donnees.favoris.offresEmploi.map(favori => ({
          idJeune: archive.idJeune,
          idOffre: favori.id,
          titre: favori.titre,
          typeContrat: favori.typeContrat,
          nomEntreprise: favori.nomEntreprise ?? null,
          duree: favori.duree ?? null,
          isAlternance: favori.alternance ?? null,
          nomLocalisation: favori.localisation?.nom ?? null,
          codePostalLocalisation: favori.localisation?.codePostal ?? null,
          communeLocalisation: favori.localisation?.commune ?? null,
          dateCreation: archive.dateArchivage,
          dateCandidature: null,
          origineNom: favori.origine?.nom ?? null,
          origineLogoUrl: favori.origine?.logo ?? null
        })),
        { transaction }
      )

      await FavoriOffreImmersionSqlModel.bulkCreate(
        donnees.favoris.offresImmersions.map(favori => ({
          idJeune: archive.idJeune,
          idOffre: favori.id,
          metier: favori.metier,
          ville: favori.ville,
          nomEtablissement: favori.nomEtablissement,
          secteurActivite: favori.secteurActivite,
          dateCreation: archive.dateArchivage,
          dateCandidature: null
        })),
        { transaction }
      )

      await FavoriOffreEngagementSqlModel.bulkCreate(
        donnees.favoris.offresServiceCivique.map(favori => ({
          idJeune: archive.idJeune,
          idOffre: favori.id,
          domaine: favori.domaine,
          titre: favori.titre,
          ville: favori.ville ?? null,
          organisation: favori.organisation ?? null,
          dateDeDebut: favori.dateDeDebut ?? null,
          dateCreation: archive.dateArchivage,
          dateCandidature: null
        })),
        { transaction }
      )

      await RechercheSqlModel.bulkCreate(
        donnees.recherches.map(recherche => ({
          id: recherche.id,
          idJeune: archive.idJeune,
          type: recherche.type,
          titre: recherche.titre,
          metier: recherche.metier ?? null,
          localisation: recherche.localisation ?? null,
          criteres: recherche.criteres ?? null,
          dateCreation: recherche.dateCreation,
          dateDerniereRecherche: recherche.dateDerniereRecherche,
          etatDerniereRecherche: recherche.etat
        })),
        { transaction }
      )
    })

    let messagesRestaures = 0
    try {
      await this.chatRepository.initializeChatIfNotExists(
        archive.idJeune,
        command.idConseiller
      )
      if (donnees?.messages?.length) {
        await this.chatRepository.restaurerMessagesIndividuels(
          archive.idJeune,
          command.idConseiller,
          donnees.messages
        )
        messagesRestaures = donnees.messages.length
      }
    } catch (e) {
      this.logger.warn(
        `Echec de la restauration du chat du jeune ${archive.idJeune}`,
        e
      )
    }

    if (!structureMiloExistante && archive.idStructureMilo) {
      this.logger.warn(
        `La structure Milo ${archive.idStructureMilo} n'existe plus : non restaurée pour le jeune ${archive.idJeune}`
      )
    }

    return success({
      idJeune: archive.idJeune,
      emailRestaure: Boolean(archive.email),
      actionsRestaurees: donnees?.actions.length ?? 0,
      rendezVousRestaures: rendezVousARestaurer.length,
      animationsCollectivesNonRestaurees:
        (donnees?.rendezVous.length ?? 0) - rendezVousARestaurer.length,
      favorisRestaures: nombreFavoris,
      recherchesRestaurees: donnees?.recherches.length ?? 0,
      messagesRestaures
    })
  }

  private construireJeune(
    archive: ArchiveJeuneSqlModel,
    idConseiller: string,
    idStructureMilo: string | null
  ): AsSql<JeuneDto> {
    return {
      id: archive.idJeune,
      nom: archive.nom,
      prenom: archive.prenom,
      idConseiller,
      idConseillerInitial: null,
      email: archive.email,
      structure: archive.structure as Core.Structure,
      dispositif: (archive.dispositif as Jeune.Dispositif) ?? null,
      idPartenaire: archive.idPartenaire,
      idStructureMilo,
      dateCreation: archive.dateCreation ?? archive.dateArchivage,
      datePremiereConnexion: archive.datePremiereConnexion,
      dateDerniereConnexion: null,
      dateFinCEJ: null,
      dateSignatureCGU: null,
      // idAuthentification null : le compte IDP a été supprimé, il sera réassocié par email à la prochaine connexion
      idAuthentification: null as unknown as string,
      pushNotificationToken: null,
      dateDerniereActualisationToken: null,
      appVersion: null,
      installationId: null,
      instanceId: null,
      timezone: null,
      partageFavoris: true,
      notificationsAlertesOffres: true,
      notificationsMessages: true,
      notificationsCreationActionConseiller: true,
      notificationsRendezVousSessions: true,
      notificationsRappelActions: true,
      notificationsActualitesMilo: true,
      peutVoirLeComptageDesHeures: null
    }
  }

  private construireAction(
    idAction: string,
    action: ArchiveJeune.Action,
    archive: ArchiveJeuneSqlModel,
    conseiller: ConseillerSqlModel
  ): AsSql<ActionDto> {
    const createur = this.construireCreateur(
      action.creePar,
      archive,
      conseiller
    )
    return {
      id: idAction,
      idJeune: archive.idJeune,
      idCreateur: createur.id,
      createur: {
        id: createur.id,
        nom: createur.nom,
        prenom: createur.prenom
      },
      typeCreateur:
        action.creePar === 'JEUNE'
          ? Action.TypeCreateur.JEUNE
          : Action.TypeCreateur.CONSEILLER,
      contenu: action.contenu,
      description: action.description,
      statut: (action.statut || Action.Statut.PAS_COMMENCEE) as Action.Statut,
      estVisibleParConseiller: true,
      dateCreation: action.dateCreation,
      dateDerniereActualisation: action.dateActualisation,
      dateEcheance: action.dateEcheance as Date,
      rappel: false,
      dateDebut: null,
      dateFinReelle: null,
      codeQualification: null,
      heuresQualifiees: null,
      commentaireQualification: null
    }
  }

  private construireRendezVous(
    idRendezVous: string,
    rendezVous: ArchiveJeune.RendezVous,
    conseiller: ConseillerSqlModel
  ): AsSql<RendezVousDto> {
    return {
      id: idRendezVous,
      source: RendezVous.Source.PASS_EMPLOI,
      titre: rendezVous.titre,
      sousTitre: rendezVous.sousTitre,
      commentaire: rendezVous.commentaire ?? null,
      modalite: rendezVous.modalite ?? null,
      date: rendezVous.date,
      duree: rendezVous.duree,
      dateCloture: null,
      type: rendezVous.type,
      precision: rendezVous.precision ?? null,
      adresse: rendezVous.adresse ?? null,
      icsSequence: null,
      organisme: rendezVous.organisme ?? null,
      presenceConseiller: rendezVous.presenceConseiller,
      invitation: null,
      createur: {
        id: conseiller.id,
        nom: conseiller.nom,
        prenom: conseiller.prenom
      },
      idAgence: null,
      typePartenaire: null,
      idPartenaire: null,
      nombreMaxParticipants: null,
      annule: false
    }
  }

  private construireCreateur(
    creePar: 'JEUNE' | 'CONSEILLER',
    archive: ArchiveJeuneSqlModel,
    conseiller: ConseillerSqlModel
  ): { id: string; nom: string; prenom: string; type: Action.TypeCreateur } {
    if (creePar === 'JEUNE') {
      return {
        id: archive.idJeune,
        nom: archive.nom,
        prenom: archive.prenom,
        type: Action.TypeCreateur.JEUNE
      }
    }
    return {
      id: conseiller.id,
      nom: conseiller.nom,
      prenom: conseiller.prenom,
      type: Action.TypeCreateur.CONSEILLER
    }
  }
}

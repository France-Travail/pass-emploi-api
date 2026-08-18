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
  isFailure,
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
  idConseiller?: string
  idJeuneRecree?: string
}

interface CibleDesarchivage {
  idJeune: string
  conseiller: ConseillerSqlModel
  jeuneACreer?: AsSql<JeuneDto>
}

export class DesarchivageJeuneQueryModel {
  @ApiProperty({
    description:
      'Bénéficiaire porteur des données restaurées : le compte recréé en cas de fusion, sinon le jeune recréé depuis l’archive'
  })
  idJeune: string

  @ApiProperty({
    description:
      'true quand les données ont été rattachées à un compte recréé au lieu de recréer le jeune archivé'
  })
  fusionAvecCompteRecree: boolean

  @ApiProperty({
    description:
      "false si l'archive ne contenait pas d'email : le jeune ne pourra pas être réassocié à son compte à la prochaine connexion. Attention : la réassociation se fait sur l'email transmis par l'IDP partenaire au login — si l'email du compte partenaire (ex. dossier i-milo) a changé depuis l'archivage, elle échouera malgré emailRestaure=true (corriger alors l'email du jeune en base)."
  })
  emailRestaure: boolean

  @ApiProperty()
  actionsRestaurees: number

  @ApiProperty()
  rendezVousRestaures: number

  @ApiProperty({
    description:
      'Actions de l’archive déjà présentes sur le compte cible (même contenu et même date d’échéance ou de création), donc non recréées'
  })
  actionsIgnoreesDoublon: number

  @ApiProperty({
    description:
      'Rendez-vous de l’archive déjà présents sur le compte cible (même date et même type), donc non recréés'
  })
  rendezVousIgnoresDoublon: number

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

    const cibleResult = command.idJeuneRecree
      ? await this.cibleFusion(command.idJeuneRecree, archive)
      : await this.cibleRecreation(command, archive)
    if (isFailure(cibleResult)) {
      return cibleResult
    }
    const { idJeune, conseiller, jeuneACreer } = cibleResult.data

    const donnees = archive.donnees
    const rendezVousHorsAnimations =
      donnees?.rendezVous.filter(
        rdv => !TYPES_ANIMATIONS_COLLECTIVES.includes(rdv.type)
      ) ?? []
    const nombreFavoris = donnees
      ? donnees.favoris.offresEmploi.length +
        donnees.favoris.offresImmersions.length +
        donnees.favoris.offresServiceCivique.length
      : 0

    const doublons = await this.detecterDoublons(
      idJeune,
      donnees?.actions ?? [],
      rendezVousHorsAnimations
    )
    const actionsARestaurer = (donnees?.actions ?? []).filter(
      action => !doublons.actions.has(action)
    )
    const rendezVousARestaurer = rendezVousHorsAnimations.filter(
      rendezVous => !doublons.rendezVous.has(rendezVous)
    )

    await this.sequelize.transaction(async transaction => {
      if (jeuneACreer) {
        await JeuneSqlModel.create(jeuneACreer, { transaction })
      }

      if (!donnees) {
        return
      }

      for (const action of actionsARestaurer) {
        const idAction = this.idService.uuid()
        await ActionSqlModel.create(
          this.construireAction(idAction, action, archive, idJeune, conseiller),
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
                idJeune,
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
          { idRendezVous, idJeune, present: null },
          { transaction }
        )
      }

      await FavoriOffreEmploiSqlModel.bulkCreate(
        donnees.favoris.offresEmploi.map(favori => ({
          idJeune,
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
        { transaction, ignoreDuplicates: true }
      )

      await FavoriOffreImmersionSqlModel.bulkCreate(
        donnees.favoris.offresImmersions.map(favori => ({
          idJeune,
          idOffre: favori.id,
          metier: favori.metier,
          ville: favori.ville,
          nomEtablissement: favori.nomEtablissement,
          secteurActivite: favori.secteurActivite,
          dateCreation: archive.dateArchivage,
          dateCandidature: null
        })),
        { transaction, ignoreDuplicates: true }
      )

      await FavoriOffreEngagementSqlModel.bulkCreate(
        donnees.favoris.offresServiceCivique.map(favori => ({
          idJeune,
          idOffre: favori.id,
          domaine: favori.domaine,
          titre: favori.titre,
          ville: favori.ville ?? null,
          organisation: favori.organisation ?? null,
          dateDeDebut: favori.dateDeDebut ?? null,
          dateCreation: archive.dateArchivage,
          dateCandidature: null
        })),
        { transaction, ignoreDuplicates: true }
      )

      await RechercheSqlModel.bulkCreate(
        donnees.recherches.map(recherche => ({
          id: recherche.id,
          idJeune,
          type: recherche.type,
          titre: recherche.titre,
          metier: recherche.metier ?? null,
          localisation: recherche.localisation ?? null,
          criteres: recherche.criteres ?? null,
          dateCreation: recherche.dateCreation,
          dateDerniereRecherche: recherche.dateDerniereRecherche,
          etatDerniereRecherche: recherche.etat
        })),
        { transaction, ignoreDuplicates: true }
      )
    })

    let messagesRestaures = 0
    try {
      await this.chatRepository.initializeChatIfNotExists(
        idJeune,
        conseiller.id
      )
      if (donnees?.messages?.length) {
        await this.chatRepository.restaurerMessagesIndividuels(
          idJeune,
          conseiller.id,
          donnees.messages
        )
        messagesRestaures = donnees.messages.length
      }
    } catch (e) {
      this.logger.warn(
        `Echec de la restauration du chat du jeune ${idJeune}`,
        e
      )
    }

    return success({
      idJeune,
      fusionAvecCompteRecree: !jeuneACreer,
      emailRestaure: Boolean(archive.email),
      actionsRestaurees: actionsARestaurer.length,
      rendezVousRestaures: rendezVousARestaurer.length,
      actionsIgnoreesDoublon: doublons.actions.size,
      rendezVousIgnoresDoublon: doublons.rendezVous.size,
      animationsCollectivesNonRestaurees:
        (donnees?.rendezVous.length ?? 0) - rendezVousHorsAnimations.length,
      favorisRestaures: nombreFavoris,
      recherchesRestaurees: donnees?.recherches.length ?? 0,
      messagesRestaures
    })
  }

  // En fusion, le conseiller a pu re-saisir des actions et rendez-vous perdus : on ne recrée pas ceux que le compte cible porte déjà
  private async detecterDoublons(
    idJeune: string,
    actions: ArchiveJeune.Action[],
    rendezVous: ArchiveJeune.RendezVous[]
  ): Promise<{
    actions: Set<ArchiveJeune.Action>
    rendezVous: Set<ArchiveJeune.RendezVous>
  }> {
    const doublons = {
      actions: new Set<ArchiveJeune.Action>(),
      rendezVous: new Set<ArchiveJeune.RendezVous>()
    }
    if (!actions.length && !rendezVous.length) {
      return doublons
    }

    const [actionsExistantes, rendezVousExistants] = await Promise.all([
      ActionSqlModel.findAll({
        attributes: ['contenu', 'dateCreation', 'dateEcheance'],
        where: { idJeune }
      }),
      RendezVousSqlModel.findAll({
        attributes: ['date', 'type'],
        include: [{ model: JeuneSqlModel, where: { id: idJeune } }]
      })
    ])

    for (const action of actions) {
      const dejaPresente = actionsExistantes.some(
        existante =>
          normaliser(existante.contenu) === normaliser(action.contenu) &&
          (memeInstant(existante.dateEcheance, action.dateEcheance) ||
            memeInstant(existante.dateCreation, action.dateCreation))
      )
      if (dejaPresente) doublons.actions.add(action)
    }

    for (const unRendezVous of rendezVous) {
      const dejaPresent = rendezVousExistants.some(
        existant =>
          existant.type === unRendezVous.type &&
          memeInstant(existant.date, unRendezVous.date)
      )
      if (dejaPresent) doublons.rendezVous.add(unRendezVous)
    }

    return doublons
  }

  // Fusion : le jeune s'est recréé un compte (nouvel id, nouvelle authentification), on ne restaure que ses données sur ce compte
  private async cibleFusion(
    idJeuneRecree: string,
    archive: ArchiveJeuneSqlModel
  ): Promise<Result<CibleDesarchivage>> {
    const jeuneRecree = await JeuneSqlModel.findByPk(idJeuneRecree, {
      include: [ConseillerSqlModel]
    })
    if (!jeuneRecree) {
      return failure(new NonTrouveError('Jeune', idJeuneRecree))
    }
    if (jeuneRecree.structure !== archive.structure) {
      return failure(
        new MauvaiseCommandeError(
          `Le jeune ${idJeuneRecree} est de structure ${jeuneRecree.structure}, incompatible avec l'archive (${archive.structure})`
        )
      )
    }
    if (!jeuneRecree.conseiller) {
      return failure(
        new MauvaiseCommandeError(
          `Le jeune ${idJeuneRecree} n'a pas de conseiller`
        )
      )
    }
    return success({
      idJeune: jeuneRecree.id,
      conseiller: jeuneRecree.conseiller
    })
  }

  private async cibleRecreation(
    command: DesarchiverJeuneCommand,
    archive: ArchiveJeuneSqlModel
  ): Promise<Result<CibleDesarchivage>> {
    if (!command.idConseiller) {
      return failure(
        new MauvaiseCommandeError(
          'Renseigner idConseiller pour recréer le jeune, ou idJeuneRecree pour fusionner avec un compte existant'
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
    if (!structureMiloExistante && archive.idStructureMilo) {
      this.logger.warn(
        `La structure Milo ${archive.idStructureMilo} n'existe plus : non restaurée pour le jeune ${archive.idJeune}`
      )
    }

    return success({
      idJeune: archive.idJeune,
      conseiller,
      jeuneACreer: this.construireJeune(
        archive,
        conseiller.id,
        structureMiloExistante ? archive.idStructureMilo : null
      )
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
    idJeune: string,
    conseiller: ConseillerSqlModel
  ): AsSql<ActionDto> {
    const createur = this.construireCreateur(
      action.creePar,
      archive,
      idJeune,
      conseiller
    )
    return {
      id: idAction,
      idJeune,
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
    idJeune: string,
    conseiller: ConseillerSqlModel
  ): { id: string; nom: string; prenom: string; type: Action.TypeCreateur } {
    if (creePar === 'JEUNE') {
      return {
        id: idJeune,
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

function normaliser(texte: string | null): string {
  return (texte ?? '').trim().toLocaleLowerCase()
}

function memeInstant(
  premiere: Date | null | undefined,
  seconde: Date | null | undefined
): boolean {
  if (!premiere || !seconde) return false
  return new Date(premiere).getTime() === new Date(seconde).getTime()
}

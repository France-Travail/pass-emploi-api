import { Inject, Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Op, Sequelize, Transaction } from 'sequelize'
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
import { Authentification } from '../../../domain/authentification'
import { Chat, ChatRepositoryToken } from '../../../domain/chat'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { Migration } from '../../../domain/migration'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { DesarchivageJeune } from '../../../domain/desarchivage-jeune'
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
import { rootLogger, toEcsError } from '../../../utils/logger.module'
import { Profil } from '../../../domain/profil'

export class DesarchivageJeuneQueryModel {
  @ApiProperty({
    description:
      'Bénéficiaire porteur des données restaurées : le compte recréé en cas de fusion, sinon le jeune recréé depuis l’archive'
  })
  idJeune: string

  @ApiProperty({
    description:
      'true quand les données ont été versées sur un compte existant (compte recréé par le jeune, ou jeune déjà restauré par un précédent désarchivage) au lieu de recréer le jeune archivé'
  })
  fusionAvecCompteRecree: boolean

  @ApiProperty({
    description:
      'true quand le compte existant était sans conseiller (non accompagné) : il a été repris en accompagnement par le conseiller (dispositif du conseiller, notifications des messages et des actions réactivées)'
  })
  rattacheAuConseiller: boolean

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
      "Messages du chat réinjectés dans Firebase (texte et historique d'édition uniquement : pièces jointes, offres liées et statuts de lecture perdus). 0 si la restauration du chat a échoué (voir les logs), ou si le chat d'origine, pas encore nettoyé, a été conservé tel quel."
  })
  messagesRestaures: number
}

@Injectable()
export class DesarchivageJeuneService {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(ChatRepositoryToken)
    private readonly chatRepository: Chat.Repository,
    private readonly idService: IdService,
    private readonly migrationService: Migration.Service,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(ConseillerRepositoryToken)
    private readonly conseillerRepository: Conseiller.Repository
  ) {}

  async trouverLeConseiller(email: string): Promise<Result<string>> {
    const conseillers = await ConseillerSqlModel.findAll({
      where: Sequelize.where(
        Sequelize.fn('lower', Sequelize.col('email')),
        email.trim().toLowerCase()
      )
    })
    if (!conseillers.length) {
      return failure(new NonTrouveError("Conseiller avec l'email", email))
    }
    if (conseillers.length > 1) {
      const liste = conseillers
        .map(({ id, structure }) => `${id} (${structure})`)
        .join(', ')
      return failure(
        new MauvaiseCommandeError(
          `Plusieurs conseillers ont l'email ${email} : ${liste}`
        )
      )
    }
    const [{ id }] = conseillers

    const migration =
      await this.migrationService.recupererMigrationDeLUtilisateur({
        id,
        type: Authentification.Type.CONSEILLER
      })
    if (migration) {
      return failure(
        new MauvaiseCommandeError(
          `Le conseiller ${id} fait partie de la population de migration ${migration.idPopulation} : le retirer de la population avant de désarchiver, sinon ses jeunes resteront bloqués à la connexion`
        )
      )
    }
    return success(id)
  }

  async desarchiver(
    idArchive: number,
    idConseiller: string
  ): Promise<Result<DesarchivageJeuneQueryModel>> {
    const conseiller = await ConseillerSqlModel.findByPk(idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', idConseiller))
    }
    const archive = await ArchiveJeuneSqlModel.findByPk(idArchive)
    if (!archive) {
      return failure(new NonTrouveError('ArchiveJeune', String(idArchive)))
    }
    if (!archive.structure) {
      return failure(
        new MauvaiseCommandeError(
          "L'archive ne contient pas la structure du jeune"
        )
      )
    }

    const cible = DesarchivageJeune.choisirLaCible(
      {
        email: archive.email,
        structure: archive.structure as Profil.Structure
      },
      await this.comptesExistants(archive),
      { id: conseiller.id, structure: conseiller.structure }
    )
    switch (cible.type) {
      case 'IGNOREE':
        return failure(new MauvaiseCommandeError(cible.message))
      case 'RECREATION':
        return this.restaurer(archive, conseiller, {
          idJeune: archive.idJeune,
          jeuneACreer: await this.preparerLaRecreation(archive, conseiller.id)
        })
      case 'FUSION': {
        if (cible.rattacherAuConseiller) {
          const repriseResult = await this.reprendreEnAccompagnement(
            cible.idJeune,
            conseiller.id
          )
          if (isFailure(repriseResult)) {
            return repriseResult
          }
        }
        return this.restaurer(archive, conseiller, {
          idJeune: cible.idJeune,
          rattacheAuConseiller: cible.rattacherAuConseiller
        })
      }
    }
  }

  private async reprendreEnAccompagnement(
    idJeune: string,
    idConseiller: string
  ): Promise<Result> {
    const conseiller = (await this.conseillerRepository.get(idConseiller))!
    if (Conseiller.doitChoisirSonDispositif(conseiller)) {
      return failure(
        new MauvaiseCommandeError(
          `Le conseiller ${idConseiller} doit choisir son dispositif avant de reprendre le jeune ${idJeune} en accompagnement`
        )
      )
    }
    const jeune = (await this.jeuneRepository.get(idJeune))!
    await this.jeuneRepository.save(
      Jeune.reprendreEnAccompagnement(jeune, conseiller)
    )
    return emptySuccess()
  }

  private async restaurer(
    archive: ArchiveJeuneSqlModel,
    conseiller: ConseillerSqlModel,
    {
      idJeune,
      jeuneACreer,
      rattacheAuConseiller = false
    }: {
      idJeune: string
      jeuneACreer?: AsSql<JeuneDto>
      rattacheAuConseiller?: boolean
    }
  ): Promise<Result<DesarchivageJeuneQueryModel>> {
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
        await ArchiveJeuneSqlModel.update(
          { nettoyageIdp: null, nettoyageChat: null },
          { where: { id: archive.id }, transaction }
        )
      }
      if (!jeuneACreer && archive.nettoyageIdp) {
        await this.sortirDuNettoyageIdpSiMemeCompte(
          archive,
          idJeune,
          transaction
        )
      }

      if (!donnees) {
        return
      }

      const actionsSql = []
      const commentairesSql = []
      for (const action of actionsARestaurer) {
        const idAction = this.idService.uuid()
        actionsSql.push(
          this.construireAction(idAction, action, archive, idJeune, conseiller)
        )
        for (const commentaire of action.commentaires ?? []) {
          commentairesSql.push({
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
          })
        }
      }
      await ActionSqlModel.bulkCreate(actionsSql, { transaction })
      await CommentaireSqlModel.bulkCreate(commentairesSql, { transaction })

      const rendezVousSql = []
      const associationsSql = []
      for (const rendezVous of rendezVousARestaurer) {
        const idRendezVous = this.idService.uuid()
        rendezVousSql.push(
          this.construireRendezVous(idRendezVous, rendezVous, conseiller)
        )
        associationsSql.push({ idRendezVous, idJeune, present: null })
      }
      await RendezVousSqlModel.bulkCreate(rendezVousSql, { transaction })
      await RendezVousJeuneAssociationSqlModel.bulkCreate(associationsSql, {
        transaction
      })

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
      messagesRestaures = await this.restaurerLeChat(
        archive,
        idJeune,
        conseiller.id,
        Boolean(jeuneACreer)
      )
    } catch (e) {
      rootLogger.error(
        {
          context: 'DesarchivageJeuneService',
          event: { action: 'restauration_chat_echouee', outcome: 'failure' },
          labels: { jeune_id: idJeune, archive_id: String(archive.id) },
          error: toEcsError(e)
        },
        'restauration_chat_echouee'
      )
    }

    return success({
      idJeune,
      fusionAvecCompteRecree: !jeuneACreer,
      rattacheAuConseiller,
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

  private async comptesExistants(
    archive: ArchiveJeuneSqlModel
  ): Promise<DesarchivageJeune.CompteExistant[]> {
    const emailNormalise = archive.email?.trim().toLowerCase()
    const memeEmail = emailNormalise
      ? [
          Sequelize.where(
            Sequelize.fn('lower', Sequelize.fn('trim', Sequelize.col('email'))),
            emailNormalise
          )
        ]
      : []
    const comptes = await JeuneSqlModel.findAll({
      attributes: ['id', 'idConseiller', 'structure'],
      where: { [Op.or]: [{ id: archive.idJeune }, ...memeEmail] }
    })
    return comptes.map(({ id, idConseiller, structure }) => ({
      id,
      idConseiller: idConseiller ?? null,
      structure
    }))
  }

  // Le compte existant peut porter la même authentification que l'archive : le nettoyage la supprimerait
  private async sortirDuNettoyageIdpSiMemeCompte(
    archive: ArchiveJeuneSqlModel,
    idJeune: string,
    transaction: Transaction
  ): Promise<void> {
    const compte = await JeuneSqlModel.findByPk(idJeune, {
      attributes: ['idAuthentification'],
      transaction
    })
    if (compte?.idAuthentification === archive.idAuthentification) {
      await ArchiveJeuneSqlModel.update(
        { nettoyageIdp: null },
        { where: { id: archive.id }, transaction }
      )
    }
  }

  private async preparerLaRecreation(
    archive: ArchiveJeuneSqlModel,
    idConseiller: string
  ): Promise<AsSql<JeuneDto>> {
    const structureMiloExistante = archive.idStructureMilo
      ? await StructureMiloSqlModel.findByPk(archive.idStructureMilo, {
          attributes: ['id']
        })
      : null
    if (!structureMiloExistante && archive.idStructureMilo) {
      rootLogger.info(
        {
          context: 'DesarchivageJeuneService',
          event: { action: 'structure_milo_non_restauree', outcome: 'failure' },
          labels: {
            jeune_id: archive.idJeune,
            structure_milo_id: archive.idStructureMilo
          }
        },
        'structure_milo_non_restauree'
      )
    }
    return this.construireJeune(
      archive,
      idConseiller,
      structureMiloExistante ? archive.idStructureMilo : null
    )
  }

  private async restaurerLeChat(
    archive: ArchiveJeuneSqlModel,
    idJeune: string,
    idConseiller: string,
    recreation: boolean
  ): Promise<number> {
    if (recreation && archive.nettoyageChat === 'A_ARCHIVER') {
      await this.chatRepository.transfererChat(idConseiller, [idJeune])
      await this.chatRepository.initializeChatIfNotExists(idJeune, idConseiller)
      return 0
    }
    if (recreation && archive.nettoyageChat === 'A_SUPPRIMER') {
      await this.chatRepository.supprimerChat(idJeune)
    }

    const messages =
      archive.nettoyageChat === 'A_ARCHIVER'
        ? await this.chatRepository.recupererMessagesAArchiver(archive.idJeune)
        : (archive.donnees?.messages ?? [])
    await this.chatRepository.initializeChatIfNotExists(idJeune, idConseiller)
    if (messages.length) {
      await this.chatRepository.restaurerMessagesIndividuels(
        idJeune,
        idConseiller,
        messages
      )
    }
    return messages.length
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

  private construireJeune(
    archive: ArchiveJeuneSqlModel,
    idConseiller: string,
    idStructureMilo: string | null
  ): AsSql<JeuneDto> {
    const structureArchive = archive.structure as Profil.Structure
    const dispositifArchive = Object.values(Profil.Dispositif).find(
      dispositif => dispositif === archive.dispositif
    )
    return {
      id: archive.idJeune,
      nom: archive.nom,
      prenom: archive.prenom,
      idConseiller,
      idConseillerInitial: null,
      email: archive.email,
      structure: structureArchive,
      dispositif: dispositifArchive ?? null,
      idPartenaire: archive.idPartenaire,
      idStructureMilo,
      dateCreation: archive.dateCreation ?? archive.dateArchivage,
      datePremiereConnexion: archive.datePremiereConnexion,
      datePremiereUtilisationInvite: null,
      dateDerniereConnexion: archive.dateDerniereConnexion,
      dateFinCEJ: null,
      dateSignatureCGU: null,
      // Compte IDP pas encore révoqué : on le reprend. Sinon null, réassocié par email à la prochaine connexion
      idAuthentification: (archive.nettoyageIdp === 'A_REVOQUER'
        ? archive.idAuthentification
        : null) as unknown as string,
      pushNotificationToken: null,
      dateDerniereActivite: null,
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

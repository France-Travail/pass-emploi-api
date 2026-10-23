import { emptySuccess, failure, Result } from '../building-blocks/types/result'
import { Jeune, JeuneRepositoryToken } from './jeune/jeune'
import { Offre } from './offre/offre'
import { Recherche } from './offre/recherche/recherche'
import { CodeTypeRendezVous } from './rendez-vous/rendez-vous'
import { Inject, Injectable } from '@nestjs/common'
import {
  Transaction,
  TransactionServiceToken
} from '../building-blocks/transaction'
import {
  ArchivageJeuneErreur,
  NonTrouveError
} from '../building-blocks/types/domain-error'
import { Chat, ChatRepositoryToken } from './chat'
import {
  Authentification,
  AuthentificationRepositoryToken
} from './authentification'
import { DateService } from '../utils/date-service'
import { rootLogger, toEcsError } from '../utils/logger.module'
import { Mail, MailServiceToken } from './mail'
import {
  Profil,
  StructureEtDispositifs,
  TOUT_CONSEIL_DEPARTEMENTAL,
  TOUT_MILO
} from './profil'

export const ArchiveJeuneRepositoryToken = 'ArchiveJeune.Repository'

export interface ArchiveJeune {
  rendezVous: ArchiveJeune.RendezVous[]
  actions: ArchiveJeune.Action[]
  favoris: {
    offresEmploi: Offre.Favori.Emploi[]
    offresImmersions: Offre.Favori.Immersion[]
    offresServiceCivique: Offre.Favori.ServiceCivique[]
  }
  recherches: Recherche[]
  dernierConseiller: {
    nom: string
    prenom: string
  }
  historiqueConseillers: Array<{
    conseillerSource: {
      nom: string
      prenom: string
    }
    conseillerCible: {
      nom: string
      prenom: string
    }
    dateDeTransfert: Date
  }>
  messages: ArchiveJeune.Message[]
}

export namespace ArchiveJeune {
  function dispositifsFranceTravail(
    dispositifs: Profil.Dispositif[]
  ): StructureEtDispositifs {
    return { structure: Profil.Structure.FRANCE_TRAVAIL, dispositifs }
  }

  export enum MotifSuppression {
    EMPLOI_DURABLE = 'Emploi durable (plus de 6 mois)',
    FORMATION = 'Formation',
    CDI = 'CDI',
    CDD_CTT = 'CDD/CTT >= 6 mois',
    EMPLOI_COURT = 'Emploi court (moins de 6 mois)',
    CONTRAT_ARRIVE_A_ECHEANCE = 'Contrat arrivé à échéance',
    CESSATION_INSCRIPTION = 'Cessation d’inscription',
    LIMITE_AGE = 'Limite d’âge atteinte',
    CHANGEMENT_ACCOMPAGNEMENT = 'Changement d’accompagnement (autre modalité ou dispositif)',
    DEMANDE_DU_JEUNE = 'Demande du jeune de sortir du dispositif',
    DEMANDE_DU_CONSEILLER = 'Sortie du dispositif à l’origine du conseiller',
    DEMANDE_DU_BENEFICIAIRE_BRSA = 'Sortie du dispositif à l’origine du bénéficiaire',
    CONSEILLER_OU_ABANDON = 'Sortie du dispositif à l’origine du conseiller ou abandon',
    NON_RESPECT_OU_ABANDON = 'Non respect des engagements ou abandon',
    DEMENAGEMENT = 'Déménagement',
    DEMENAGEMENT_TERRITOIRE_HORS_EXPERIMENTATION = 'Déménagement dans un territoire hors expérimentation',
    CHANGEMENT_CONSEILLER = 'Changement de conseiller',
    SERVICE_CIVIQUE = 'Service civique',
    CREATION_ENTREPRISE = 'Création d’entreprise',
    ESAT = 'Entrée en ESAT',
    AUTRE = 'Autre'
  }

  export enum MotifSuppressionSupport {
    SUPPORT = 'Support',
    MIGRATION = 'Migration'
  }

  export const motifsSuppression: Record<
    MotifSuppression,
    {
      profils: readonly StructureEtDispositifs[]
      description?: string
    }
  > = {
    [MotifSuppression.EMPLOI_DURABLE]: {
      profils: [
        TOUT_MILO,
        dispositifsFranceTravail([
          Profil.Dispositif.CEJ,
          Profil.Dispositif.BRSA,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ],
      description:
        'CDI, CDD de plus de 6 mois dont alternance, titularisation dans la fonction publique'
    },
    [MotifSuppression.CDI]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO
        ])
      ]
    },
    [MotifSuppression.CDD_CTT]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO
        ])
      ]
    },
    [MotifSuppression.EMPLOI_COURT]: {
      profils: [
        TOUT_MILO,
        dispositifsFranceTravail([
          Profil.Dispositif.CEJ,
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO
        ])
      ]
    },
    [MotifSuppression.FORMATION]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ])
      ]
    },
    [MotifSuppression.SERVICE_CIVIQUE]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO
        ])
      ]
    },
    [MotifSuppression.CONTRAT_ARRIVE_A_ECHEANCE]: {
      profils: [TOUT_MILO, dispositifsFranceTravail([Profil.Dispositif.CEJ])]
    },
    [MotifSuppression.CESSATION_INSCRIPTION]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.BRSA,
          Profil.Dispositif.AIJ
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.LIMITE_AGE]: {
      profils: [TOUT_MILO, dispositifsFranceTravail([Profil.Dispositif.CEJ])],
      description:
        "Motif valable uniquement à partir de la fin du premier mois des 26 ans. A noter : dans le cas oû le jeune est considéré en tant que travailleur handicapé, l'âge passe à 30 ans."
    },
    [MotifSuppression.CHANGEMENT_ACCOMPAGNEMENT]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.BRSA,
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.DEMANDE_DU_JEUNE]: {
      profils: [TOUT_MILO, dispositifsFranceTravail([Profil.Dispositif.CEJ])]
    },
    [MotifSuppression.DEMANDE_DU_CONSEILLER]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.BRSA,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.DEMANDE_DU_BENEFICIAIRE_BRSA]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.BRSA,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.NON_RESPECT_OU_ABANDON]: {
      profils: [TOUT_MILO, dispositifsFranceTravail([Profil.Dispositif.CEJ])]
    },
    [MotifSuppression.CONSEILLER_OU_ABANDON]: {
      profils: [dispositifsFranceTravail([Profil.Dispositif.AIJ])]
    },
    [MotifSuppression.DEMENAGEMENT]: {
      profils: [
        TOUT_MILO,
        dispositifsFranceTravail([
          Profil.Dispositif.CEJ,
          Profil.Dispositif.BRSA,
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.DEMENAGEMENT_TERRITOIRE_HORS_EXPERIMENTATION]: {
      profils: [
        dispositifsFranceTravail([Profil.Dispositif.BRSA]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ]
    },
    [MotifSuppression.CHANGEMENT_CONSEILLER]: {
      profils: [TOUT_MILO, dispositifsFranceTravail([Profil.Dispositif.CEJ])]
    },
    [MotifSuppression.CREATION_ENTREPRISE]: {
      profils: [
        dispositifsFranceTravail([
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO,
          Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
          Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
          Profil.Dispositif.EQUIP_EMPLOI_RECRUT
        ])
      ]
    },
    [MotifSuppression.ESAT]: {
      profils: [dispositifsFranceTravail([Profil.Dispositif.AIJ])]
    },
    [MotifSuppression.AUTRE]: {
      profils: [
        TOUT_MILO,
        dispositifsFranceTravail([
          Profil.Dispositif.CEJ,
          Profil.Dispositif.BRSA,
          Profil.Dispositif.AIJ,
          Profil.Dispositif.AVENIR_PRO
        ]),
        TOUT_CONSEIL_DEPARTEMENTAL
      ],
      description: 'Champ libre'
    }
  }

  export interface Metadonnees {
    idJeune: string
    email?: string
    prenomJeune: string
    nomJeune: string
    structure: Profil.Structure
    dispositif?: Profil.Dispositif
    idPopulation?: string
    idPartenaire?: string
    dateCreation: Date
    datePremiereConnexion?: Date
    dateFinAccompagnement?: Date
    motif: MotifSuppression | MotifSuppressionSupport
    commentaire?: string
    dateArchivage: Date
    nettoyageDiffere?: boolean
  }

  export type EtapeNettoyageIdp = 'A_REVOQUER'
  export type EtapeNettoyageChat = 'A_ARCHIVER' | 'A_SUPPRIMER'

  export interface RendezVous {
    titre: string
    sousTitre: string
    commentaire?: string
    modalite?: string
    date: Date
    duree: number
    type: CodeTypeRendezVous
    precision?: string
    adresse?: string
    organisme?: string
    presenceConseiller: boolean
  }

  export interface Action {
    statut: string
    contenu: string
    description: string
    dateCreation: Date
    dateActualisation: Date
    dateEcheance?: Date
    creePar: 'JEUNE' | 'CONSEILLER'
    commentaires?: Array<{
      date: Date
      message: string
      creePar: 'JEUNE' | 'CONSEILLER'
    }>
  }

  export interface Message {
    contenu: string
    date: string
    envoyePar: string
    type: string
    historique?: EntreeHistoriqueMessage[]
  }

  export type EntreeHistoriqueMessage = {
    date: string
    contenuPrecedent: string
  }

  export interface ArchiveMigration {
    idPopulation: string | null
  }

  export interface ArchiveConstruite {
    metadonnees: Metadonnees
    idStructureMilo: string | null
    idAuthentification: string | null
    idConseiller: string | null
    donnees: ArchiveJeune
  }

  export interface ArchiveANettoyer {
    id: number
    idJeune: string
    idAuthentification: string | null
    idPopulation: string | null
    nettoyageIdp: EtapeNettoyageIdp | null
    nettoyageChat: EtapeNettoyageChat | null
  }

  export interface ResultatArchivageEnMasse {
    idsJeunesArchives: string[]
    nbEchecsNettoyage: number
  }

  export interface Repository {
    archiver(metadonnes: ArchiveJeune.Metadonnees): Promise<Result>
    construireArchives(
      metadonnees: ArchiveJeune.Metadonnees[]
    ): Promise<ArchiveConstruite[]>
    enregistrerArchives(archives: ArchiveConstruite[]): Promise<number[]>
    idsArchivesANettoyer(criteres: {
      taille: number
      apresId?: number
      idPopulation?: string
    }): Promise<number[]>
    recupererArchivesANettoyer(
      idsArchives: number[]
    ): Promise<ArchiveANettoyer[]>
    marquerIdpRevoque(idArchive: number): Promise<void>
    verserLesMessages(idArchive: number, messages: Message[]): Promise<void>
    marquerChatSupprime(idArchive: number): Promise<void>
    archiverSansDonnees(metadonnees: ArchiveJeune.Metadonnees): Promise<Result>
    getIdsArchivesBefore(date: Date): Promise<number[]>
    trouverArchiveAvecMotif(
      emailJeune: string,
      motif: MotifSuppression | MotifSuppressionSupport
    ): Promise<ArchiveMigration | undefined>
    findById(idArchive: number): Promise<boolean>
    delete(idArchive: number): Promise<void>
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(JeuneRepositoryToken)
      private readonly jeuneRepository: Jeune.Repository,
      @Inject(ArchiveJeuneRepositoryToken)
      private readonly archiveJeuneRepository: ArchiveJeune.Repository,
      @Inject(ChatRepositoryToken)
      private readonly chatRepository: Chat.Repository,
      @Inject(AuthentificationRepositoryToken)
      private readonly authentificationRepository: Authentification.Repository,
      private readonly dateService: DateService,
      @Inject(MailServiceToken)
      private readonly mailService: Mail.Service,
      @Inject(TransactionServiceToken)
      private readonly transactionService: Transaction.Service
    ) {}

    async archiver(
      idJeune: string,
      commentaireSuppressionSupport: string,
      motifSuppression: MotifSuppressionSupport,
      idPopulation?: string
    ): Promise<Result> {
      let resultat: ResultatArchivageEnMasse
      try {
        resultat = await this.archiverEnMasse(
          [idJeune],
          commentaireSuppressionSupport,
          motifSuppression,
          idPopulation
        )
      } catch (e) {
        loguerEchecArchivage("Échec lors de l'archivage du jeune", idJeune, e)
        return failure(new ArchivageJeuneErreur(idJeune))
      }

      if (!resultat.idsJeunesArchives.length) {
        return failure(new NonTrouveError('Jeune', idJeune))
      }
      return emptySuccess()
    }

    async archiverEnMasse(
      idsJeunes: string[],
      commentaireSuppressionSupport: string,
      motifSuppression: MotifSuppressionSupport,
      idPopulation?: string
    ): Promise<ResultatArchivageEnMasse> {
      const jeunes = await this.jeuneRepository.findAll(idsJeunes)
      if (!jeunes.length) return { idsJeunesArchives: [], nbEchecsNettoyage: 0 }

      const archives = await this.archiveJeuneRepository.construireArchives(
        jeunes
          .filter(estCompteActif)
          .map(jeune =>
            this.metadonneesArchive(
              jeune,
              commentaireSuppressionSupport,
              motifSuppression,
              idPopulation
            )
          )
      )
      const nbEchecsSuppressionIdp = await this.supprimerLesComptesIdp(jeunes)

      const idsJeunesArchives = await this.supprimerEtArchiver(jeunes, archives)
      const jeunesArchives = jeunes.filter(({ id }) =>
        idsJeunesArchives.includes(id)
      )

      const nbEchecsSuppressionChat =
        await this.supprimerLesChats(jeunesArchives)
      const nbEchecsEnvoiMail = await this.prevenirLesComptesActifs(
        jeunesArchives.filter(estCompteActif),
        motifSuppression,
        commentaireSuppressionSupport
      )

      return {
        idsJeunesArchives,
        nbEchecsNettoyage:
          nbEchecsSuppressionIdp + nbEchecsSuppressionChat + nbEchecsEnvoiMail
      }
    }

    private async supprimerEtArchiver(
      jeunes: Jeune[],
      archives: ArchiveConstruite[]
    ): Promise<string[]> {
      let idsJeunesSupprimes: string[] = []
      await this.transactionService.executer(async () => {
        idsJeunesSupprimes = await this.jeuneRepository.supprimerEnMasse(
          jeunes.map(({ id }) => id)
        )
        await this.archiveJeuneRepository.enregistrerArchives(
          archives.filter(({ metadonnees }) =>
            idsJeunesSupprimes.includes(metadonnees.idJeune)
          )
        )
        return emptySuccess()
      })
      return idsJeunesSupprimes
    }

    // Avant la suppression : l'idAuthentification n'est plus lisible ensuite, et
    // la suppression IdP tolère le 404, donc un lot rejoué la refait sans risque.
    private async supprimerLesComptesIdp(jeunes: Jeune[]): Promise<number> {
      const idsAuthentification =
        await this.authentificationRepository.recupererIdsAuthentificationDesJeunes(
          jeunes.map(({ id }) => id)
        )
      let nbEchecs = 0
      for (const [idJeune, idAuthentification] of idsAuthentification) {
        try {
          await this.authentificationRepository.supprimerCompteIdp(
            idAuthentification
          )
        } catch (e) {
          rootLogger.error(
            {
              context: 'ArchiveJeune.Service',
              labels: {
                jeune_id: idJeune,
                authentification_id: idAuthentification,
                etape: 'idp'
              },
              error: toEcsError(e)
            },
            'Échec lors de la suppression du compte IdP du jeune'
          )
          nbEchecs++
        }
      }
      return nbEchecs
    }

    private async supprimerLesChats(jeunes: Jeune[]): Promise<number> {
      let nbEchecs = 0
      for (const jeune of jeunes) {
        try {
          await this.chatRepository.supprimerChat(jeune.id)
        } catch (e) {
          loguerEchecArchivage(
            'Échec lors de la suppression du chat du jeune',
            jeune.id,
            e,
            'chat'
          )
          nbEchecs++
        }
      }
      return nbEchecs
    }

    private async prevenirLesComptesActifs(
      jeunes: Jeune[],
      motifSuppression: MotifSuppressionSupport,
      commentaireSuppressionSupport: string
    ): Promise<number> {
      let nbEchecs = 0
      for (const jeune of jeunes) {
        try {
          await this.mailService.envoyerEmailJeuneArchive(
            jeune,
            motifSuppression,
            commentaireSuppressionSupport
          )
        } catch (e) {
          loguerEchecArchivage(
            "Échec lors de l'envoi du mail au jeune",
            jeune.id,
            e,
            'mail'
          )
          nbEchecs++
        }
      }
      return nbEchecs
    }

    private metadonneesArchive(
      jeune: Jeune,
      commentaireSuppressionSupport: string,
      motifSuppression: MotifSuppressionSupport,
      idPopulation?: string
    ): Metadonnees {
      return {
        idJeune: jeune.id,
        email: jeune.email,
        prenomJeune: jeune.firstName,
        nomJeune: jeune.lastName,
        structure: jeune.structure,
        dateCreation: jeune.creationDate.toJSDate(),
        datePremiereConnexion: jeune.datePremiereConnexion?.toJSDate(),
        motif: motifSuppression,
        commentaire: commentaireSuppressionSupport,
        dateArchivage: this.dateService.nowJs(),
        dispositif: jeune.dispositif ?? undefined,
        ...(idPopulation && { idPopulation })
      }
    }
  }
}

function estCompteActif(jeune: Jeune): boolean {
  return (
    Boolean(jeune.configuration.dateDerniereActivite) &&
    Boolean(jeune.dateDerniereConnexion)
  )
}

function loguerEchecArchivage(
  message: string,
  idJeune: string,
  error: unknown,
  etape?: 'chat' | 'mail'
): void {
  rootLogger.error(
    {
      context: 'ArchiveJeune.Service',
      labels: { jeune_id: idJeune, ...(etape && { etape }) },
      error: toEcsError(error)
    },
    message
  )
}

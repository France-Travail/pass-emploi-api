import { Injectable, Logger } from '@nestjs/common'
import { Notification } from '../../domain/notification/notification'
import { DateService } from '../../utils/date-service'
import { IdService } from '../../utils/id-service'
import { FirebaseClient } from '../clients/firebase-client'
import { MatomoClient } from '../clients/matomo-client'
import {
  NotificationJeuneDto,
  NotificationJeuneSqlModel
} from '../sequelize/models/notification-jeune.sql-model'
import { AsSql } from '../sequelize/types'

export enum TypeNotificationRepository {
  NEW_ACTION = 'NEW_ACTION',
  NEW_ACTU = 'NEW_ACTU',
  NEW_RENDEZVOUS = 'NEW_RENDEZVOUS',
  DELETED_RENDEZVOUS = 'DELETED_RENDEZVOUS',
  NEW_MESSAGE = 'NEW_MESSAGE',
  NOUVELLE_OFFRE = 'NOUVELLE_OFFRE',
  DETAIL_ACTION = 'DETAIL_ACTION',
  DETAIL_SESSION_MILO = 'DETAIL_SESSION_MILO',
  DELETED_SESSION_MILO = 'DELETED_SESSION_MILO',
  RAPPEL_CREATION_ACTION = 'RAPPEL_CREATION_ACTION',
  RAPPEL_CREATION_DEMARCHE = 'RAPPEL_CREATION_DEMARCHE',
  OUTILS = 'OUTILS',
  SAVED_SEARCHES = 'SAVED_SEARCHES',
  OFFRES_ENREGISTREES = 'OFFRES_ENREGISTREES',
  RECHERCHE = 'RECHERCHE',
  ACTUALISATION_PE = 'ACTUALISATION_PE',
  MON_SUIVI = 'MON_SUIVI',
  EVENT_LIST = 'EVENT_LIST',
  LA_BONNE_ALTERNANCE = 'LA_BONNE_ALTERNANCE',
  BENEVOLAT = 'BENEVOLAT',
  CAMPAGNE = 'CAMPAGNE',
  NOUVELLES_FONCTIONNALITES = 'NOUVELLES_FONCTIONNALITES',
  CENTRE_DE_NOTIFS_UNIQUEMENT = 'CENTRE_DE_NOTIFS_UNIQUEMENT',
  MIGRATION_PARCOURS_EMPLOI = 'MIGRATION_PARCOURS_EMPLOI'
}

export type NotificationRepository = {
  token: string
  notification: {
    title: string
    body: string
  }
  data: {
    type: TypeNotificationRepository
    id?: string
  }
}

function typeNotificationToTypeNotificationRepository(
  typeNotification: Notification.Type
): TypeNotificationRepository {
  switch (typeNotification) {
    case Notification.Type.NEW_ACTION:
      return TypeNotificationRepository.NEW_ACTION
    case Notification.Type.NEW_ACTU:
      return TypeNotificationRepository.NEW_ACTU
    case Notification.Type.NEW_RENDEZVOUS:
    case Notification.Type.RAPPEL_RENDEZVOUS:
    case Notification.Type.UPDATED_RENDEZVOUS:
    case Notification.Type.CANCELED_RENDEZVOUS:
      return TypeNotificationRepository.NEW_RENDEZVOUS
    case Notification.Type.DELETED_RENDEZVOUS:
      return TypeNotificationRepository.DELETED_RENDEZVOUS
    case Notification.Type.NEW_MESSAGE:
      return TypeNotificationRepository.NEW_MESSAGE
    case Notification.Type.NOUVELLE_OFFRE:
      return TypeNotificationRepository.NOUVELLE_OFFRE
    case Notification.Type.DETAIL_ACTION:
      return TypeNotificationRepository.DETAIL_ACTION
    case Notification.Type.DETAIL_SESSION_MILO:
      return TypeNotificationRepository.DETAIL_SESSION_MILO
    case Notification.Type.DELETED_SESSION_MILO:
      return TypeNotificationRepository.DELETED_SESSION_MILO
    case Notification.Type.RAPPEL_CREATION_ACTION:
      return TypeNotificationRepository.RAPPEL_CREATION_ACTION
    case Notification.Type.RAPPEL_CREATION_DEMARCHE:
      return TypeNotificationRepository.RAPPEL_CREATION_DEMARCHE
    case Notification.Type.OUTILS:
      return TypeNotificationRepository.OUTILS
    case Notification.Type.SAVED_SEARCHES:
      return TypeNotificationRepository.SAVED_SEARCHES
    case Notification.Type.OFFRES_ENREGISTREES:
      return TypeNotificationRepository.OFFRES_ENREGISTREES
    case Notification.Type.RECHERCHE:
      return TypeNotificationRepository.RECHERCHE
    case Notification.Type.ACTUALISATION_PE:
      return TypeNotificationRepository.ACTUALISATION_PE
    case Notification.Type.MON_SUIVI:
      return TypeNotificationRepository.MON_SUIVI
    case Notification.Type.EVENT_LIST:
      return TypeNotificationRepository.EVENT_LIST
    case Notification.Type.LA_BONNE_ALTERNANCE:
      return TypeNotificationRepository.LA_BONNE_ALTERNANCE
    case Notification.Type.BENEVOLAT:
      return TypeNotificationRepository.BENEVOLAT
    case Notification.Type.CAMPAGNE:
      return TypeNotificationRepository.CAMPAGNE
    case Notification.Type.NOUVELLES_FONCTIONNALITES:
      return TypeNotificationRepository.NOUVELLES_FONCTIONNALITES
    case Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT:
      return TypeNotificationRepository.CENTRE_DE_NOTIFS_UNIQUEMENT
    case Notification.Type.MIGRATION_PARCOURS_EMPLOI:
      return TypeNotificationRepository.MIGRATION_PARCOURS_EMPLOI
  }
}

@Injectable()
export class NotificationFirebaseSqlRepository
  implements Notification.Repository
{
  private readonly logger: Logger = new Logger(
    'NotificationFirebaseSqlRepository'
  )

  constructor(
    private readonly firebaseClient: FirebaseClient,
    private readonly matomoClient: MatomoClient,
    private readonly idService: IdService,
    private readonly dateService: DateService
  ) {}

  async send(
    message: Notification.Message,
    idJeune?: string,
    pushNotification: boolean = true
  ): Promise<void> {
    const messageFirebase: NotificationRepository = {
      ...message,
      data: {
        ...message.data,
        type: typeNotificationToTypeNotificationRepository(message.data.type)
      }
    }
    if (pushNotification) {
      this.firebaseClient.send(messageFirebase)
      this.matomoClient.trackEventPushNotificationEnvoyee(messageFirebase)
    }
    if (idJeune) {
      const notifSql: AsSql<NotificationJeuneDto> = {
        id: this.idService.uuid(),
        idJeune,
        dateNotif: this.dateService.now().toJSDate(),
        type: messageFirebase.data.type,
        titre: message.notification.title,
        description: message.notification.body,
        idObjet: message.data.id || null
      }
      NotificationJeuneSqlModel.create(notifSql).catch(e => {
        this.logger.error('Erreur création ', e)
      })
    }
  }
}

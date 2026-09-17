import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'
import { Notification } from './notification/notification'

export const CommunicationRepositoryToken = 'CommunicationRepositoryToken'

// Limites de NotifierBeneficiairesPayload : le contenu d'une communication NOTIFICATION
// devient le titre et le corps de la notification push.
const TITRE_NOTIFICATION_MAX = 50
const CONTENU_NOTIFICATION_MAX = 150

export interface Communication {
  idPopulation: string
  destinataire: Communication.Destinataire
  type: Communication.Type
  dateDebut: DateTime
  dateFin?: DateTime
  titre: string
  contenu: string
  ctaLabel?: string
  ctaUrlAndroid?: string
  ctaUrlIos?: string
  typeNotification?: Notification.Type
}

export namespace Communication {
  export enum Destinataire {
    JEUNE = 'JEUNE',
    CONSEILLER = 'CONSEILLER'
  }

  export enum Type {
    IN_APP = 'IN_APP',
    NOTIFICATION = 'NOTIFICATION'
  }

  export interface MessageInformatif {
    id: number
    titre: string
    contenu: string
  }

  export interface Cta {
    label: string
    urlAndroid: string
    urlIos: string
  }

  export interface MessageInformatifJeune extends MessageInformatif {
    cta?: Cta
  }

  export interface Repository {
    // Visible entre date_debut (incluse) et date_fin (exclue) ; s'il y en a plusieurs, celle dont la fin est la plus proche.
    getMessageInformatifDuConseiller(
      idConseiller: string,
      maintenant: DateTime
    ): Promise<MessageInformatif | undefined>

    getMessageInformatifDuJeune(
      idJeune: string,
      maintenant: DateTime
    ): Promise<MessageInformatifJeune | undefined>
  }

  export function creer(aCreer: Communication): Result<Communication> {
    if (!aCreer.dateDebut.isValid) {
      return failure(new MauvaiseCommandeError('Date de début invalide'))
    }
    if (aCreer.dateFin) {
      if (!aCreer.dateFin.isValid) {
        return failure(new MauvaiseCommandeError('Date de fin invalide'))
      }
      if (aCreer.dateDebut >= aCreer.dateFin) {
        return failure(
          new MauvaiseCommandeError(
            'La date de début doit précéder la date de fin'
          )
        )
      }
    }
    const champsCta = [aCreer.ctaLabel, aCreer.ctaUrlAndroid, aCreer.ctaUrlIos]
    const nbChampsCtaRenseignes = champsCta.filter(Boolean).length
    if (nbChampsCtaRenseignes > 0 && nbChampsCtaRenseignes < champsCta.length) {
      return failure(
        new MauvaiseCommandeError(
          'ctaLabel, ctaUrlAndroid et ctaUrlIos doivent être renseignés ensemble ou absents ensemble'
        )
      )
    }
    if (aCreer.type === Type.NOTIFICATION) {
      if (aCreer.destinataire !== Destinataire.JEUNE) {
        return failure(
          new MauvaiseCommandeError(
            'Une communication NOTIFICATION ne peut cibler que les JEUNE'
          )
        )
      }
      if (aCreer.dateFin) {
        return failure(
          new MauvaiseCommandeError(
            'dateFin est réservée aux communications IN_APP : une NOTIFICATION envoyée ne peut pas être rappelée'
          )
        )
      }
      if (!aCreer.typeNotification) {
        return failure(
          new MauvaiseCommandeError(
            'typeNotification est requis pour une communication NOTIFICATION'
          )
        )
      }
      if (
        aCreer.typeNotification ===
        Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
      ) {
        return failure(
          new MauvaiseCommandeError(
            'typeNotification ne peut pas valoir CENTRE_DE_NOTIFS_UNIQUEMENT pour une communication envoyée en push'
          )
        )
      }
      if (aCreer.titre.length > TITRE_NOTIFICATION_MAX) {
        return failure(
          new MauvaiseCommandeError(
            `Le titre d'une communication NOTIFICATION est limité à ${TITRE_NOTIFICATION_MAX} caractères`
          )
        )
      }
      if (aCreer.contenu.length > CONTENU_NOTIFICATION_MAX) {
        return failure(
          new MauvaiseCommandeError(
            `Le contenu d'une communication NOTIFICATION est limité à ${CONTENU_NOTIFICATION_MAX} caractères`
          )
        )
      }
    } else if (aCreer.typeNotification) {
      return failure(
        new MauvaiseCommandeError(
          'typeNotification est réservé aux communications NOTIFICATION'
        )
      )
    }
    return success({ ...aCreer })
  }
}

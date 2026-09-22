import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'

export const CommunicationRepositoryToken = 'CommunicationRepositoryToken'

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
    // TODO: retirer quand l'envoi des NOTIFICATION sera livré (feat/communications-notifications)
    if (aCreer.type === Type.NOTIFICATION) {
      return failure(
        new MauvaiseCommandeError(
          "Les communications NOTIFICATION ne sont pas encore disponibles à l'envoi"
        )
      )
    }
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
    return success({ ...aCreer })
  }
}

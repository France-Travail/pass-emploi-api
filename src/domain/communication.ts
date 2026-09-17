import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'

export const CommunicationRepositoryToken = 'CommunicationRepositoryToken'

export interface Communication {
  idPopulation: string
  destinataire: Communication.Destinataire
  type: Communication.Type
  dateDebut: DateTime
  dateFin: DateTime
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

  export interface Repository {
    // Visible entre date_debut (incluse) et date_fin (exclue) ; s'il y en a plusieurs, celle dont la fin est la plus proche.
    getMessageInformatifDuConseiller(
      idConseiller: string,
      maintenant: DateTime
    ): Promise<MessageInformatif | undefined>
  }

  export function creer(aCreer: Communication): Result<Communication> {
    if (!aCreer.dateDebut.isValid || !aCreer.dateFin.isValid) {
      return failure(
        new MauvaiseCommandeError('Date de début ou de fin invalide')
      )
    }
    if (aCreer.dateDebut >= aCreer.dateFin) {
      return failure(
        new MauvaiseCommandeError(
          'La date de début doit précéder la date de fin'
        )
      )
    }
    return success({ ...aCreer })
  }
}

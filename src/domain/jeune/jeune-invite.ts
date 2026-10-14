import { DateTime } from 'luxon'

export const JeuneInviteRepositoryToken = 'JeuneInviteRepositoryToken'

export const JeuneInviteConfigurationApplicationRepositoryToken =
  'JeuneInviteConfigurationApplicationRepositoryToken'

export const JeuneInviteJetonServiceToken = 'JeuneInviteJetonServiceToken'

export namespace JeuneInvite {
  export interface PourReprise {
    id: string
    dateCreation: DateTime
    dateReprise?: DateTime
  }

  export interface PourPurge {
    id: string
    idAuthentification: string
  }

  export interface Repository {
    existe(id: string): Promise<boolean>
    recupererInvitesInactifs(
      dateSeuil: Date
    ): Promise<
      Array<{ id: string; idAuthentification: string; dateReference: Date }>
    >
    compterTout(): Promise<number>
    supprimerPlusieurs(ids: string[]): Promise<void>
    recupererPourReprise(id: string): Promise<PourReprise | undefined>
    marquerRepris(id: string, dateReprise: DateTime): Promise<boolean>
    recupererInvitesRepris(): Promise<PourPurge[]>
  }

  // Preuve de possession d'un compte invité : undefined si le jeton est refusé
  // (signature, expiration, pas un invité) ; lève si Connect est injoignable
  export interface JetonService {
    idInviteDuJeton(jeton: string): Promise<string | undefined>
  }
}

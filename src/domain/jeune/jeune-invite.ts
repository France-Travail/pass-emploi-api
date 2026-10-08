import { DateTime } from 'luxon'

export const JeuneInviteRepositoryToken = 'JeuneInviteRepositoryToken'

export const JeuneInviteConfigurationApplicationRepositoryToken =
  'JeuneInviteConfigurationApplicationRepositoryToken'

export namespace JeuneInvite {
  export interface Repository {
    existe(id: string): Promise<boolean>
    recupererInvitesInactifs(
      dateSeuil: Date
    ): Promise<
      Array<{ id: string; idAuthentification: string; dateReference: Date }>
    >
    compterTout(): Promise<number>
    supprimerPlusieurs(ids: string[]): Promise<void>
    recupererPourReprise(
      id: string
    ): Promise<
      | { id: string; dateCreation: DateTime; idJeuneRepreneur?: string }
      | undefined
    >
    marquerRepris(
      id: string,
      idJeuneRepreneur: string,
      dateReprise: DateTime
    ): Promise<void>
    recupererInvitesRepris(): Promise<
      Array<{ id: string; idAuthentification: string }>
    >
  }
}

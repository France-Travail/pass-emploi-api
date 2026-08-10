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
  }
}

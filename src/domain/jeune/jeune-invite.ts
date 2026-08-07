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
    existeActiviteDepuis(depuis: Date): Promise<boolean>
    supprimer(id: string): Promise<void>
  }
}

export const JeuneInviteRepositoryToken = 'JeuneInviteRepositoryToken'

export const JeuneInviteConfigurationApplicationRepositoryToken =
  'JeuneInviteConfigurationApplicationRepositoryToken'

export namespace JeuneInvite {
  export interface Repository {
    existe(id: string): Promise<boolean>
    recupererInvitesInactifs(
      dateSeuil: Date,
      limite: number
    ): Promise<Array<{ id: string; idAuthentification: string }>>
    compterTout(): Promise<number>
    supprimer(id: string): Promise<void>
  }
}

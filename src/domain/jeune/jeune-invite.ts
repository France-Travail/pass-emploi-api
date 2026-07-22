export const JeuneInviteRepositoryToken = 'JeuneInviteRepositoryToken'

export const JeuneInviteConfigurationApplicationRepositoryToken =
  'JeuneInviteConfigurationApplicationRepositoryToken'

export namespace JeuneInvite {
  export interface Repository {
    existe(id: string): Promise<boolean>
  }
}

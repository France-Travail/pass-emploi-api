export const PopulationRepositoryToken = 'PopulationRepositoryToken'

export namespace Population {
  // Résolue à la lecture : un conseiller y est s'il est cité par email ou si son propre profil structure × dispositif correspond ; un jeune y est si son propre profil correspond ou si son conseiller de référence est cité par email.
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    // Jeunes dont le profil correspond à la population, ou dont le conseiller de référence y est cité par email.
    getIdsDesJeunesParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
    // Conseillers cités par email, ou dont le propre profil correspond à la population.
    getIdsDesConseillersParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
  }
}

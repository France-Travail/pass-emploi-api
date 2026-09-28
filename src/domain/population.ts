export const PopulationRepositoryToken = 'PopulationRepositoryToken'

export namespace Population {
  // Résolue à la lecture : un conseiller y est s'il est cité par email ou si son profil structure × dispositif correspond ; un jeune y est si et seulement si son conseiller de référence y est.
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    // Jeunes dont le conseiller de référence est cité par email ou a un profil qui correspond à la population.
    getIdsDesJeunesParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
    // Conseillers cités par email, ou dont le profil correspond à la population.
    getIdsDesConseillersParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<string[]>
  }
}

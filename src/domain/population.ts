export const PopulationRepositoryToken = 'PopulationRepositoryToken'

export namespace Population {
  // Résolue à la lecture : un conseiller y est par email ou par profil structure × dispositif, un jeune y est via son conseiller de référence.
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    getIdsDesBeneficiaires(idPopulation: string): Promise<string[]>
  }
}

export const PopulationRepositoryToken = 'PopulationRepositoryToken'

export namespace Population {
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
  }
}

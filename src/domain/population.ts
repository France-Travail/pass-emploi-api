export const PopulationRepositoryToken = 'PopulationRepositoryToken'

export namespace Population {
  export interface Repository {
    existe(idPopulation: string): Promise<boolean>
    getIdsPopulationsDuConseiller(idConseiller: string): Promise<string[]>
    getIdsPopulationsDuJeune(idJeune: string): Promise<string[]>
  }
}

import { DateTime } from 'luxon'

export const FonctionnaliteRepositoryToken = 'FonctionnaliteRepositoryToken'

export namespace Fonctionnalite {
  export interface Repository {
    // Une affectation sans date d'activation est active immédiatement
    getIdsFonctionnalitesActives(
      idsPopulations: string[],
      maintenant: DateTime
    ): Promise<string[]>
  }
}

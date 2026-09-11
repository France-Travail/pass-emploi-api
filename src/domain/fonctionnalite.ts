import { DateTime } from 'luxon'

export const FonctionnaliteRepositoryToken = 'FonctionnaliteRepositoryToken'

export namespace Fonctionnalite {
  // Les ids des fonctionnalités sont posés par le support, aucun n'est connu de l'API.
  export interface Repository {
    // Une affectation sans date d'activation est active immédiatement.
    getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
      idBeneficiaire: string,
      maintenant: DateTime
    ): Promise<string[]>
  }
}

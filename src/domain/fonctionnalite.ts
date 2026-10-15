import { DateTime } from 'luxon'

export const FonctionnaliteRepositoryToken = 'FonctionnaliteRepositoryToken'

export namespace Fonctionnalite {
  // Les ids sont posés par le support : seuls ceux que l'API contrôle elle-même figurent ici
  export enum Id {
    DISPOSITIF_AUTRE = 'DISPOSITIF_AUTRE'
  }

  export interface Repository {
    // Une affectation sans date d'activation est active immédiatement
    getIdsFonctionnalitesActivesDuJeune(
      idJeune: string,
      maintenant: DateTime
    ): Promise<string[]>

    getIdsFonctionnalitesActivesDuConseiller(
      idConseiller: string,
      maintenant: DateTime
    ): Promise<string[]>
  }
}

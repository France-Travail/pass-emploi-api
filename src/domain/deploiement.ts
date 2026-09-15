import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'

export interface Deploiement {
  nature: Deploiement.Nature
  idPopulation: string
  idFonctionnalite?: string
  dateActivation: DateTime
}

export namespace Deploiement {
  // Seule énumération du mécanisme : à J, FONCTIONNALITE fait apparaître le drapeau, MIGRATION refuse la connexion.
  export enum Nature {
    FONCTIONNALITE = 'FONCTIONNALITE',
    MIGRATION = 'MIGRATION'
  }

  export interface ACreer {
    nature: Nature
    idPopulation: string
    idFonctionnalite?: string
    dateActivation: DateTime
  }

  // Invariant du déploiement : FONCTIONNALITE exige une fonctionnalité, MIGRATION n'en porte pas.
  export function creer(aCreer: ACreer): Result<Deploiement> {
    const estFonctionnalite = aCreer.nature === Nature.FONCTIONNALITE
    if (estFonctionnalite && !aCreer.idFonctionnalite) {
      return failure(
        new MauvaiseCommandeError(
          'Un déploiement de nature FONCTIONNALITE exige idFonctionnalite'
        )
      )
    }
    if (!estFonctionnalite && aCreer.idFonctionnalite) {
      return failure(
        new MauvaiseCommandeError(
          'Un déploiement de nature MIGRATION ne porte pas de fonctionnalité'
        )
      )
    }
    return success({
      nature: aCreer.nature,
      idPopulation: aCreer.idPopulation,
      idFonctionnalite: aCreer.idFonctionnalite,
      dateActivation: aCreer.dateActivation
    })
  }
}

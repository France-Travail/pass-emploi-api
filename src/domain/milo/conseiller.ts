import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Agence } from '../agence'
import {
  DISPOSITIFS_FT_ACCOMPAGNES,
  estFranceTravail,
  estMilo,
  Profil
} from '../profil'
import * as _ListeDeDiffusion from './liste-de-diffusion'
import * as _Conseiller from './conseiller.milo.db'

export interface Conseiller {
  id: string
  firstName: string
  lastName: string
  structure: Profil.Structure
  dispositif: Profil.Dispositif | null
  email?: string
  dateVerificationMessages?: DateTime
  dateSignatureCGU?: DateTime
  dateVisionnageActus?: DateTime
  agence?: Agence
  notificationsSonores: boolean
  dateMajAgence?: DateTime
}

export const ConseillerRepositoryToken = 'ConseillerRepositoryToken'

export namespace Conseiller {
  export import Milo = _Conseiller.ConseillerMilo

  export import ListeDeDiffusion = _ListeDeDiffusion.ListeDeDiffusion

  export interface Repository {
    get(id: string): Promise<Conseiller | undefined>

    getByIdAuthentification(
      idAuthentification: string
    ): Promise<Conseiller | undefined>

    getAllIds(): Promise<string[]>

    existe(idConseiller: string, structure: Profil.Structure): Promise<boolean>

    findConseillersMessagesNonVerifies(
      nombreConseillers: number,
      dateVerification: DateTime
    ): Promise<Conseiller[]>

    save(conseiller: Conseiller): Promise<void>

    updateDateVerificationMessages(
      idconseiller: string,
      dateVerification: Date
    ): Promise<void>

    delete(idConseiller: string): Promise<void>
  }

  export function modifierAgence(
    conseiller: Conseiller,
    agence: Agence
  ): Conseiller {
    return {
      ...conseiller,
      agence
    }
  }

  export function mettreAJour(
    conseiller: Conseiller,
    infosDeMiseAJour: InfosDeMiseAJour
  ): Result<Conseiller> {
    const conseilleMiloARenseigneUneAgenceManuelle =
      estMilo(conseiller.structure) &&
      infosDeMiseAJour.agence &&
      !infosDeMiseAJour.agence.id

    if (conseilleMiloARenseigneUneAgenceManuelle) {
      return failure(
        new MauvaiseCommandeError(
          'Un conseiller MILO doit choisir une Agence du référentiel'
        )
      )
    }

    if (
      !estFranceTravail(conseiller.structure) &&
      conseiller.agence?.id &&
      infosDeMiseAJour.agence?.id &&
      conseiller.agence.id !== infosDeMiseAJour.agence.id
    ) {
      return failure(
        new MauvaiseCommandeError('Un conseiller ne peut pas changer d’agence')
      )
    }

    const dispositifChoisiHorsFranceTravail =
      infosDeMiseAJour.dispositif && !estFranceTravail(conseiller.structure)
    if (dispositifChoisiHorsFranceTravail) {
      return failure(
        new MauvaiseCommandeError(
          'Seul un conseiller France Travail choisit son dispositif'
        )
      )
    }

    const dispositifInterditPourUnConseillerFT =
      infosDeMiseAJour.dispositif &&
      !DISPOSITIFS_FT_ACCOMPAGNES.dispositifs!.includes(
        infosDeMiseAJour.dispositif
      )
    if (dispositifInterditPourUnConseillerFT) {
      return failure(
        new MauvaiseCommandeError(
          'Ce dispositif n’est pas proposé aux conseillers France Travail'
        )
      )
    }

    return success({
      ...conseiller,
      agence: infosDeMiseAJour.agence,
      dispositif: infosDeMiseAJour.dispositif ?? conseiller.dispositif,
      notificationsSonores: Boolean(infosDeMiseAJour.notificationsSonores),
      dateSignatureCGU: infosDeMiseAJour.dateSignatureCGU,
      dateVisionnageActus: infosDeMiseAJour.dateVisionnageActus,
      dateMajAgence: infosDeMiseAJour.dateMajAgence
    })
  }

  export function doitChoisirSonDispositif(conseiller: Conseiller): boolean {
    return estFranceTravail(conseiller.structure) && !conseiller.dispositif
  }

  export interface InfosDeMiseAJour {
    agence?: Agence
    dispositif?: Profil.Dispositif
    dateSignatureCGU?: DateTime
    dateVisionnageActus?: DateTime
    notificationsSonores?: boolean
    dateMajAgence?: DateTime
  }
}

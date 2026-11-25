import { Action } from '../action/action'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../authentification'
import {
  JeuneMiloSansStructure,
  MauvaiseCommandeError
} from '../../building-blocks/types/domain-error'
import { JeuneMilo } from './jeune.milo'

export const ActionMiloRepositoryToken = 'ActionMiloRepositoryToken'

export interface ActionMilo extends Action.Qualifiee {
  idDossier: string
  loginConseiller: string
  timezoneStructure: string
}

export namespace ActionMilo {
  export interface Repository {
    creerSituationNonProfessionnelle(
      action: ActionMilo,
      getIdpToken: () => Promise<string>
    ): Promise<Result>
  }

  export function creer(
    action: Action.Qualifiee,
    jeune: JeuneMilo,
    utilisateur: Authentification.Utilisateur
  ): Result<ActionMilo> {
    if (!jeune.idPartenaire) {
      return failure(
        new MauvaiseCommandeError(`Le jeune ${jeune.id} n'a pas d'id dossier`)
      )
    }

    if (!jeune.structureMilo) {
      return failure(new JeuneMiloSansStructure(jeune.id))
    }

    if (!utilisateur.username) {
      return failure(
        new MauvaiseCommandeError("L'utilisateur n'a pas d'username")
      )
    }

    const data: ActionMilo = {
      ...action,
      idDossier: jeune.idPartenaire,
      loginConseiller: utilisateur.username,
      timezoneStructure: jeune.structureMilo.timezone
    }
    return success(data)
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { isAxiosError } from 'axios'
import {
  emptySuccess,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import { ActionMilo } from '../../../domain/milo/action.milo'
import { MiloClient } from '../../clients/milo/milo-client'

@Injectable()
export class ActionMiloHttpRepository implements ActionMilo.Repository {
  private logger: Logger

  constructor(private readonly miloClient: MiloClient) {
    this.logger = new Logger('ActionMiloHttpSqlRepository')
  }

  async creerSituationNonProfessionnelle(
    action: ActionMilo,
    getIdpToken: () => Promise<string>
  ): Promise<Result> {
    const body = {
      dateDebut: action.dateDebut.toFormat('yyyy-MM-dd'),
      dateFinReelle: action.dateFinReelle.toFormat('yyyy-MM-dd'),
      commentaire: action.qualification.commentaire,
      mesure: action.qualification.code,
      loginConseiller: action.loginConseiller
    }

    let result: Result
    try {
      result = await this.miloClient.creerSituationDossier(
        action.idDossier,
        body,
        getIdpToken
      )
    } catch (e) {
      if (!estUnTimeout(e)) throw e
      this.logger.warn(
        `SNP considérée créée malgré le timeout pour le dossier ${action.idDossier}`
      )
      return emptySuccess()
    }
    if (isFailure(result)) {
      return result
    }

    this.logger.log(
      `SNP créée pour le dossier ${action.idDossier} : ${JSON.stringify(body)}`
    )

    return result
  }
}

function estUnTimeout(erreur: unknown): boolean {
  return (
    isAxiosError(erreur) &&
    (erreur.code === 'ECONNABORTED' || erreur.code === 'ETIMEDOUT')
  )
}

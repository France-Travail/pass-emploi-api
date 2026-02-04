import { Injectable, Logger } from '@nestjs/common'
import { isFailure, Result } from '../../../building-blocks/types/result'
import { ActionMilo } from '../../../domain/milo/action.milo'
import { MiloClient } from '../../clients/milo/milo-client'

@Injectable()
export class ActionMiloHttpRepository implements ActionMilo.Repository {
  private logger: Logger

  constructor(private readonly miloClient: MiloClient) {
    this.logger = new Logger('ActionMiloHttpSqlRepository')
  }

  async save(action: ActionMilo): Promise<Result> {
    const body = {
      dateDebut: action.dateDebut.toFormat('yyyy-MM-dd'),
      dateFinReelle: action.dateFinReelle.toFormat('yyyy-MM-dd'),
      commentaire: action.qualification.commentaire,
      mesure: action.qualification.code,
      loginConseiller: action.loginConseiller
    }

    const result = await this.miloClient.creerSituationDossier(
      action.idDossier,
      body
    )
    if (isFailure(result)) {
      return result
    }

    this.logger.log(
      `SNP créée pour le dossier ${action.idDossier} : ${JSON.stringify(body)}`
    )

    return result
  }
}

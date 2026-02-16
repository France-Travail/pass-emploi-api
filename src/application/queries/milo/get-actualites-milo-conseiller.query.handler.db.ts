import { Inject, Injectable } from '@nestjs/common'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import { Authentification } from '../../../domain/authentification'
import { estMilo } from '../../../domain/core'
import { isFailure, Result } from '../../../building-blocks/types/result'
import {
  ActualiteMiloConseillerQueryModel,
  ActualitesMiloConseillerQueryModel
} from '../query-models/actualites-milo.query-model'
import { Conseiller } from '../../../domain/milo/conseiller'
import { ConseillerMiloRepositoryToken } from '../../../domain/milo/conseiller.milo.db'

export interface GetActualitesMiloConseillerQuery {
  idConseiller: string
}

@Injectable()
export class GetActualitesMiloConseillerQueryHandler extends QueryHandler<
  GetActualitesMiloConseillerQuery,
  ActualitesMiloConseillerQueryModel
> {
  constructor(
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    @Inject(ConseillerMiloRepositoryToken)
    private readonly conseillerMiloRepository: Conseiller.Milo.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('GetActualitesMiloConseillerQueryHandler')
  }

  async authorize(
    query: GetActualitesMiloConseillerQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      query.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async handle(
    query: GetActualitesMiloConseillerQuery,
    _utilisateur: Authentification.Utilisateur
  ): Promise<ActualitesMiloConseillerQueryModel> {
    const resultConseiller = await this.conseillerMiloRepository.get(
      query.idConseiller
    )

    if (isFailure(resultConseiller)) {
      return { actualites: [] }
    }

    const conseiller = resultConseiller.data

    const actualites = await this.actualiteMiloRepository.getByStructureMilo(
      conseiller.structure.id
    )

    const actualitesQueryModel: ActualiteMiloConseillerQueryModel[] =
      actualites.map(actualite => ({
        id: actualite.id,
        titre: actualite.titre,
        contenu: actualite.contenu,
        titreLien: actualite.titreLien,
        lien: actualite.lien,
        prenomNomConseiller: actualite.prenomNomConseiller,
        dateCreation: actualite.dateCreation.toISO(),
        dateSuppression: actualite.dateSuppression?.toISO(),
        proprietaire: actualite.idConseiller === query.idConseiller
      }))

    return {
      actualites: actualitesQueryModel
    }
  }

  async monitor(): Promise<void> {
    return
  }
}

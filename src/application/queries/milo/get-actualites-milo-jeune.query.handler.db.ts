import { Inject, Injectable } from '@nestjs/common'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { JeuneAuthorizer } from '../../authorizers/jeune-authorizer'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import { Authentification } from '../../../domain/authentification'
import { isFailure, Result } from '../../../building-blocks/types/result'
import {
  ActualiteMiloJeuneQueryModel,
  ActualitesMiloJeuneQueryModel
} from '../query-models/actualites-milo.query-model'
import {
  JeuneMilo,
  JeuneMiloRepositoryToken
} from '../../../domain/milo/jeune.milo'

export interface GetActualitesMiloJeuneQuery {
  idJeune: string
}

@Injectable()
export class GetActualitesMiloJeuneQueryHandler extends QueryHandler<
  GetActualitesMiloJeuneQuery,
  ActualitesMiloJeuneQueryModel
> {
  constructor(
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    @Inject(JeuneMiloRepositoryToken)
    private readonly jeuneRepository: JeuneMilo.Repository,
    private readonly jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetActualitesMiloJeuneQueryHandler')
  }

  async authorize(
    query: GetActualitesMiloJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async handle(
    query: GetActualitesMiloJeuneQuery
  ): Promise<ActualitesMiloJeuneQueryModel> {
    const jeune = await this.jeuneRepository.get(query.idJeune)

    if (isFailure(jeune)) {
      return { actualites: [] }
    }

    if (!jeune.data.idStructureMilo) {
      return { actualites: [] }
    }

    const actualites = await this.actualiteMiloRepository.getByStructureMilo(
      jeune.data.idStructureMilo
    )

    const actualitesQueryModel: ActualiteMiloJeuneQueryModel[] = actualites.map(
      actualite => ({
        titre: actualite.titre,
        contenu: actualite.contenu,
        titreLien: actualite.titreLien,
        lien: actualite.lien,
        prenomNomConseiller: actualite.prenomNomConseiller,
        dateCreation: actualite.dateCreation.toISO(),
        dateSuppression: actualite.dateSuppression?.toISO()
      })
    )

    return {
      actualites: actualitesQueryModel
    }
  }

  async monitor(): Promise<void> {
    return
  }
}

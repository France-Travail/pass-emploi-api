import { Inject, Injectable } from '@nestjs/common'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { JeuneAuthorizer } from '../../authorizers/jeune-authorizer'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import { Authentification } from '../../../domain/authentification'
import { Result } from '../../../building-blocks/types/result'
import {
  ActualiteMiloJeuneQueryModel,
  ActualitesMiloJeuneQueryModel
} from '../query-models/actualites-milo.query-model'
import { JeuneSqlModel } from '../../../infrastructure/sequelize/models/jeune.sql-model'
import { StructureMiloSqlModel } from '../../../infrastructure/sequelize/models/structure-milo.sql-model'

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
    const jeune = await JeuneSqlModel.findByPk(query.idJeune, {
      include: [{ model: StructureMiloSqlModel, required: false }]
    })

    if (!jeune?.structureMilo?.id) {
      return { actualites: [] }
    }

    const actualites = await this.actualiteMiloRepository.getByStructureMilo(
      jeune.structureMilo.id
    )

    const actualitesQueryModel: ActualiteMiloJeuneQueryModel[] = actualites.map(
      actualite => ({
        titre: actualite.titre,
        contenu: actualite.contenu,
        titreLien: actualite.titreLien,
        lien: actualite.lien,
        nomPrenomConseiller: actualite.prenomNomConseiller,
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

import { Injectable } from '@nestjs/common'
import { Query } from 'src/building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  DISPOSITIFS_FT_AVEC_DEMARCHES,
  Profil,
  TOUT_CONSEIL_DEPARTEMENTAL
} from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { ThematiqueQueryModel } from './query-models/catalogue.query-model'

import { catalogueDemarchesInMemory } from 'src/infrastructure/clients/utils/demarches-in-memory'

export interface GetCatalogueDemarchesQuery extends Query {
  accessToken: string
  structure: Profil.Structure
}

@Injectable()
export class GetCatalogueDemarchesQueryHandler extends QueryHandler<
  GetCatalogueDemarchesQuery,
  ThematiqueQueryModel[]
> {
  readonly profilsAutorises = [
    DISPOSITIFS_FT_AVEC_DEMARCHES,
    TOUT_CONSEIL_DEPARTEMENTAL
  ]

  constructor(private readonly jeuneAuthorizer: JeuneAuthorizer) {
    super('GetCatalogueQueryHandler')
  }

  async handle(
    _query: GetCatalogueDemarchesQuery
  ): Promise<ThematiqueQueryModel[]> {
    return catalogueDemarchesInMemory.map(thematique => {
      return {
        code: thematique.code,
        libelle: thematique.libelle,
        demarches: thematique.demarches.map(demarche => ({
          ...demarche,
          commentObligatoire: false,
          comment: []
        }))
      }
    })
  }

  async authorize(
    _query: GetCatalogueDemarchesQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(utilisateur.id, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

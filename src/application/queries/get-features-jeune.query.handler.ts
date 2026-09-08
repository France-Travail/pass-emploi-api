import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  FeatureFlip,
  FeatureFlipRepositoryToken
} from '../../domain/feature-flip'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { FeatureJeuneQueryModel } from './query-models/jeunes.query-model'

export interface GetFeaturesJeuneQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetFeaturesJeuneQueryHandler extends QueryHandler<
  GetFeaturesJeuneQuery,
  Result<FeatureJeuneQueryModel[]>
> {
  readonly profilsAutorises = TOUT_PROFIL_SAUF_INVITE

  constructor(
    @Inject(FeatureFlipRepositoryToken)
    private readonly featureFlipRepository: FeatureFlip.Repository,
    private readonly jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetFeaturesJeuneQueryHandler')
  }

  async handle(
    query: GetFeaturesJeuneQuery
  ): Promise<Result<FeatureJeuneQueryModel[]>> {
    const tagsActifs =
      await this.featureFlipRepository.getTagsActifsPourLeConseillerDuJeune(
        query.idJeune
      )

    return success(
      Object.values(FeatureFlip.Tag).map(featureTag => ({
        featureTag,
        active: tagsActifs.includes(featureTag)
      }))
    )
  }

  async authorize(
    query: GetFeaturesJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { CGUJeuneQueryModel } from './query-models/jeunes.query-model'

export interface GetCGUJeuneQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetCGUJeuneQueryHandler extends QueryHandler<
  GetCGUJeuneQuery,
  Result<CGUJeuneQueryModel>
> {
  readonly profilsAutorises = TOUT_PROFIL_SAUF_INVITE

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    private readonly jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetCGUJeuneQueryHandler')
  }

  async handle(query: GetCGUJeuneQuery): Promise<Result<CGUJeuneQueryModel>> {
    const jeune = await this.jeuneRepository.get(query.idJeune)
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', query.idJeune))
    }

    return success({
      dateSignatureCGU: jeune.dateSignatureCGU?.toUTC().toISO() ?? undefined
    })
  }

  async authorize(
    query: GetCGUJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}

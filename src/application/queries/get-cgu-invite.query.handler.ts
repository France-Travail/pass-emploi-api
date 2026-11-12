import { Inject, Injectable } from '@nestjs/common'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../domain/profil'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export class CGUInviteQueryModel {
  @ApiPropertyOptional()
  dateSignatureCGU?: string
}

export interface GetCGUInviteQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetCGUInviteQueryHandler extends QueryHandler<
  GetCGUInviteQuery,
  Result<CGUInviteQueryModel>
> {
  readonly profilsAutorises = TOUT_INVITE

  constructor(
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer
  ) {
    super('GetCGUInviteQueryHandler')
  }

  async handle(query: GetCGUInviteQuery): Promise<Result<CGUInviteQueryModel>> {
    const cgu = await this.jeuneInviteRepository.recupererCGU(query.idJeune)

    if (!cgu) {
      return failure(new NonTrouveError('Jeune invité', query.idJeune))
    }

    return success({
      dateSignatureCGU: cgu.dateSignature?.toUTC().toISO() ?? undefined
    })
  }

  async authorize(
    query: GetCGUInviteQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      query.idJeune,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

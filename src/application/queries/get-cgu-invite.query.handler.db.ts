import { Injectable } from '@nestjs/common'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_INVITE } from '../../domain/profil'
import { JeuneInviteSqlModel } from '../../infrastructure/sequelize/models/jeune-invite.sql-model'
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

  constructor(private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer) {
    super('GetCGUInviteQueryHandler')
  }

  async handle(query: GetCGUInviteQuery): Promise<Result<CGUInviteQueryModel>> {
    const jeuneInvite = await JeuneInviteSqlModel.findByPk(query.idJeune)

    if (!jeuneInvite) {
      return failure(new NonTrouveError('Jeune invité', query.idJeune))
    }

    return success({
      dateSignatureCGU: jeuneInvite.dateSignatureCGU?.toISOString()
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

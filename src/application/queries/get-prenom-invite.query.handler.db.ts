import { Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { JeuneInviteSqlModel } from '../../infrastructure/sequelize/models/jeune-invite.sql-model'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'

export class PrenomInviteQueryModel {
  @ApiProperty()
  prenom: string
}

export interface GetPrenomInviteQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetPrenomInviteQueryHandler extends QueryHandler<
  GetPrenomInviteQuery,
  Result<PrenomInviteQueryModel>
> {
  constructor(private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer) {
    super('GetPrenomInviteQueryHandler')
  }

  async handle(
    query: GetPrenomInviteQuery
  ): Promise<Result<PrenomInviteQueryModel>> {
    const jeuneInvite = await JeuneInviteSqlModel.findByPk(query.idJeune)

    if (!jeuneInvite) {
      return failure(new NonTrouveError('Jeune invité', query.idJeune))
    }

    return success({ prenom: jeuneInvite.prenom })
  }

  async authorize(
    query: GetPrenomInviteQuery,
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

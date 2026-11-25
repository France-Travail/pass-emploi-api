import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { isFailure, Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_INVITE } from '../../domain/profil'
import {
  StructureAccompagnement,
  StructureAccompagnementRepositoryToken
} from '../../domain/structure-accompagnement'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import {
  StructureAccompagnementQueryModel,
  TypeStructureAccompagnement
} from './query-models/structures-accompagnement.query-model'

export interface GetStructuresAccompagnementQuery extends Query {
  type: TypeStructureAccompagnement
  codeInsee: string
  codePostal: string
}

@Injectable()
export class GetStructuresAccompagnementQueryHandler extends QueryHandler<
  GetStructuresAccompagnementQuery,
  Result<StructureAccompagnementQueryModel[]>
> {
  readonly profilsAutorises = TOUT_INVITE

  constructor(
    @Inject(StructureAccompagnementRepositoryToken)
    private readonly structureAccompagnementRepository: StructureAccompagnement.Repository,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer
  ) {
    super('GetStructuresAccompagnementQueryHandler')
  }

  async handle(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    return query.type === TypeStructureAccompagnement.MILO
      ? this.recupererMissionLocale(query)
      : this.recupererAgencesFT(query)
  }

  async authorize(
    _query: GetStructuresAccompagnementQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      utilisateur.id,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }

  private async recupererAgencesFT(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    return this.structureAccompagnementRepository.findAllAgencesFranceTravail(
      query.codeInsee,
      query.codePostal
    )
  }

  private async recupererMissionLocale(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    const result =
      await this.structureAccompagnementRepository.findMissionLocale(
        query.codeInsee,
        query.codePostal
      )
    if (isFailure(result)) return result

    return success(result.data ? [result.data] : [])
  }
}

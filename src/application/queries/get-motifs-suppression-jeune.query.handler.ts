import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import {
  emptySuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import { Injectable } from '@nestjs/common'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Profil, profilEstAutorise, TOUT_PROFIL } from '../../domain/profil'
import { MotifSuppressionJeuneQueryModel } from './query-models/jeunes.query-model'

export interface GetMotifsSuppressionQuery extends Query {
  profil: Profil
}
@Injectable()
export class GetMotifsSuppressionJeuneQueryHandler extends QueryHandler<
  Query,
  Result<MotifSuppressionJeuneQueryModel[]>
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor() {
    super('GetMotifsSuppressionJeuneQueryHandler')
  }

  async handle(
    query: GetMotifsSuppressionQuery
  ): Promise<Result<MotifSuppressionJeuneQueryModel[]>> {
    return success(
      Object.entries(ArchiveJeune.motifsSuppression)
        .filter(([_, { profils }]) => profilEstAutorise(query.profil, profils))
        .map(([motif, { description }]) => ({
          motif,
          description: description
        }))
    )
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import { FonctionnaliteSqlModel } from '../../infrastructure/sequelize/models/fonctionnalite.sql-model'
import { FonctionnalitesSupportQueryModel } from './query-models/fonctionnalites.query-model'

// Lecture support : le référentiel des fonctionnalités, pour savoir quel id déployer.
@Injectable()
export class GetFonctionnalitesSupportQueryHandler extends QueryHandler<
  Query,
  Result<FonctionnalitesSupportQueryModel>
> {
  constructor() {
    super('GetFonctionnalitesSupportQueryHandler')
  }

  async handle(): Promise<Result<FonctionnalitesSupportQueryModel>> {
    const fonctionnalites = await FonctionnaliteSqlModel.findAll({
      order: [['id', 'ASC']]
    })
    return success({ fonctionnalites: fonctionnalites.map(f => f.id) })
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

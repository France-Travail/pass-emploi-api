import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { CommunicationSupportDetailQueryModel } from './query-models/population-support.query-model'
import { envoiDe } from './get-population-support.query.handler.db'

export interface GetCommunicationSupportQuery extends Query {
  idCommunication: number
}

@Injectable()
export class GetCommunicationSupportQueryHandler extends QueryHandler<
  GetCommunicationSupportQuery,
  Result<CommunicationSupportDetailQueryModel>
> {
  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository
  ) {
    super('GetCommunicationSupportQueryHandler')
  }

  async handle(
    query: GetCommunicationSupportQuery
  ): Promise<Result<CommunicationSupportDetailQueryModel>> {
    const communication = await CommunicationSqlModel.findByPk(
      query.idCommunication
    )
    if (!communication) {
      return failure(
        new NonTrouveError('Communication', String(query.idCommunication))
      )
    }

    const envoi = await envoiDe(communication, this.communicationRepository)

    return success({
      idPopulation: communication.idPopulation,
      destinataire: communication.destinataire,
      type: communication.type,
      dateDebut: DateTime.fromJSDate(communication.dateDebut).toUTC().toISO()!,
      dateFin: communication.dateFin
        ? DateTime.fromJSDate(communication.dateFin).toUTC().toISO()!
        : undefined,
      titre: communication.titre,
      contenu: communication.contenu,
      ctaLabel: communication.ctaLabel ?? undefined,
      ctaUrlAndroid: communication.ctaUrlAndroid ?? undefined,
      ctaUrlIos: communication.ctaUrlIos ?? undefined,
      typeNotification: communication.typeNotification ?? undefined,
      push: communication.push ?? undefined,
      statutEnvoi: communication.statutEnvoi ?? undefined,
      envoiTermineLe: communication.envoiTermineLe
        ? DateTime.fromJSDate(communication.envoiTermineLe).toUTC().toISO()!
        : undefined,
      ...envoi
    })
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

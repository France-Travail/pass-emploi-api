import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Communication } from '../../../domain/communication'
import { Notification } from '../../../domain/notification/notification'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'

export interface CreerCommunicationCommand extends Command {
  idPopulation: string
  destinataire: Communication.Destinataire
  type: Communication.Type
  dateDebut: DateTime
  dateFin?: DateTime
  titre: string
  contenu: string
  ctaLabel?: string
  ctaUrlAndroid?: string
  ctaUrlIos?: string
  typeNotification?: Notification.Type
}

export interface CommunicationCreee {
  id: number
}

@Injectable()
export class CreerCommunicationCommandHandler extends CommandHandler<
  CreerCommunicationCommand,
  CommunicationCreee
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('CreerCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: CreerCommunicationCommand
  ): Promise<Result<CommunicationCreee>> {
    const communicationResult = Communication.creer(command)
    if (isFailure(communicationResult)) return communicationResult
    const communication = communicationResult.data

    if (!(await this.populationRepository.existe(communication.idPopulation))) {
      return failure(
        new NonTrouveError('Population', communication.idPopulation)
      )
    }

    const enregistree = await CommunicationSqlModel.create({
      idPopulation: communication.idPopulation,
      destinataire: communication.destinataire,
      type: communication.type,
      dateDebut: communication.dateDebut.toJSDate(),
      dateFin: communication.dateFin?.toJSDate() ?? null,
      titre: communication.titre,
      contenu: communication.contenu,
      ctaLabel: communication.ctaLabel ?? null,
      ctaUrlAndroid: communication.ctaUrlAndroid ?? null,
      ctaUrlIos: communication.ctaUrlIos ?? null,
      typeNotification: communication.typeNotification ?? null
    })
    return success({ id: enregistree.id })
  }
}

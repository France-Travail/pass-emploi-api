import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import { Communication } from '../../../domain/communication'
import { Notification } from '../../../domain/notification/notification'
import {
  Population,
  PopulationRepositoryToken
} from '../../../domain/population'
import { CommunicationSqlModel } from '../../../infrastructure/sequelize/models/communication.sql-model'

export interface ModifierCommunicationCommand extends Command {
  id: number
  idPopulation: string
  destinataire: Communication.Destinataire
  type: Communication.Type
  dateDebut: DateTime
  dateFin: DateTime
  titre: string
  contenu: string
  ctaLabel?: string
  ctaUrlAndroid?: string
  ctaUrlIos?: string
  typeNotification?: Notification.Type
}

// Remplace la communication en entier (PUT) : un champ absent du payload est effacé,
// pas conservé. Évite d'avoir à distinguer "non envoyé" de "à vider" pour les CTA optionnels.
@Injectable()
export class ModifierCommunicationCommandHandler extends CommandHandler<
  ModifierCommunicationCommand,
  void
> {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository
  ) {
    super('ModifierCommunicationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: ModifierCommunicationCommand): Promise<Result> {
    const existante = await CommunicationSqlModel.findByPk(command.id)
    if (!existante) {
      return failure(new NonTrouveError('Communication', String(command.id)))
    }

    const communicationResult = Communication.creer(command)
    if (isFailure(communicationResult)) return communicationResult
    const communication = communicationResult.data

    if (!(await this.populationRepository.existe(communication.idPopulation))) {
      return failure(
        new NonTrouveError('Population', communication.idPopulation)
      )
    }

    await existante.update({
      idPopulation: communication.idPopulation,
      destinataire: communication.destinataire,
      type: communication.type,
      dateDebut: communication.dateDebut.toJSDate(),
      dateFin: communication.dateFin.toJSDate(),
      titre: communication.titre,
      contenu: communication.contenu,
      ctaLabel: communication.ctaLabel ?? null,
      ctaUrlAndroid: communication.ctaUrlAndroid ?? null,
      ctaUrlIos: communication.ctaUrlIos ?? null,
      typeNotification: communication.typeNotification ?? null
    })
    return emptySuccess()
  }
}

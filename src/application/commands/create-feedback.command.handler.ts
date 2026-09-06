import { Injectable } from '@nestjs/common'
import { DateService } from 'src/utils/date-service'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_PROFIL } from '../../domain/profil'
import { FeedbackSqlModel } from '../../infrastructure/sequelize/models/feedback.sql-model'

export interface CreateFeedbackCommand extends Command {
  tag: string
  note: number
  commentaire?: string
}

@Injectable()
export class CreateFeedbackCommandHandler extends CommandHandler<
  CreateFeedbackCommand,
  void
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(private readonly dateService: DateService) {
    super('CreateFeedbackCommandHandler')
  }

  async handle(
    command: CreateFeedbackCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    await FeedbackSqlModel.create({
      idUtilisateur: utilisateur.id,
      dateCreation: this.dateService.nowJs(),
      structure: utilisateur.profil.structure,
      dispositif: utilisateur.profil.dispositif,
      tag: command.tag,
      note: command.note,
      commentaire: command.commentaire
    })
    return emptySuccess()
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {}
}

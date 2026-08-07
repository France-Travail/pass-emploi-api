import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Result, emptySuccess } from '../../../building-blocks/types/result'
import {
  Superviseur,
  SuperviseursRepositoryToken
} from '../../../domain/superviseur'
import { Profil } from '../../../domain/profil'

export interface DeleteSuperviseursCommand extends Command {
  emails: string[]
}

@Injectable()
export class DeleteSuperviseursCommandHandler extends CommandHandler<
  DeleteSuperviseursCommand,
  void
> {
  readonly profilsAutorises = [Profil.Support.SUPPORT]

  constructor(
    @Inject(SuperviseursRepositoryToken)
    private readonly superviseurRepository: Superviseur.Repository
  ) {
    super('DeleteSuperviseursCommandHandler')
  }

  async handle(command: DeleteSuperviseursCommand): Promise<Result<void>> {
    await this.superviseurRepository.deleteSuperviseurs(command.emails)
    return emptySuccess()
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

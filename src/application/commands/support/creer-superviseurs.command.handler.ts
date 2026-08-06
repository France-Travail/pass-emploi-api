import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Result, emptySuccess } from '../../../building-blocks/types/result'
import {
  Superviseur,
  SuperviseursRepositoryToken
} from '../../../domain/superviseur'
import { Profil } from '../../../domain/profil'

export interface CreerSuperviseursCommand extends Command {
  emails: string[]
}

@Injectable()
export class CreerSuperviseursCommandHandler extends CommandHandler<
  CreerSuperviseursCommand,
  void
> {
  readonly profilsAutorises = [Profil.Support.SUPPORT]

  constructor(
    @Inject(SuperviseursRepositoryToken)
    private readonly superviseurRepository: Superviseur.Repository
  ) {
    super('CreerSuperviseursCommandHandler')
  }

  async handle(command: CreerSuperviseursCommand): Promise<Result> {
    if (command.emails.length) {
      await this.superviseurRepository.saveSuperviseurs(command.emails)
    }
    return emptySuccess()
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

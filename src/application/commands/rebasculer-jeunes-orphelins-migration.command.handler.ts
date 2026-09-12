import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Migration } from '../../domain/migration'

export interface RebasculerJeunesOrphelinsMigrationCommand {
  phaseDeMigration: string
}

@Injectable()
export class RebasculerJeunesOrphelinsMigrationCommandHandler extends CommandHandler<
  RebasculerJeunesOrphelinsMigrationCommand,
  void
> {
  constructor(private readonly migrationService: Migration.Service) {
    super('RebasculerJeunesOrphelinsMigrationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(
    command: RebasculerJeunesOrphelinsMigrationCommand
  ): Promise<Result> {
    // La route déplace des bénéficiaires : on refuse un id inconnu plutôt que
    // de rapporter zéro rebasculement.
    const migrationExiste = await this.migrationService.migrationExiste(
      command.phaseDeMigration
    )
    if (!migrationExiste) {
      return failure(new NonTrouveError('Migration', command.phaseDeMigration))
    }

    const rebasculements = await this.migrationService.rebasculerOrphelins(
      command.phaseDeMigration
    )
    rebasculements.forEach(
      ({ idJeune, ancienIdConseiller, nouveauIdConseiller }) =>
        this.logger.log(
          { idJeune, ancienIdConseiller, nouveauIdConseiller },
          'Jeune rebasculé'
        )
    )
    this.logger.log(
      {
        phaseDeMigration: command.phaseDeMigration,
        count: rebasculements.length
      },
      'Rebasculement orphelins terminé'
    )
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Migration, MigrationRepositoryToken } from '../../domain/migration'

export interface RebasculerJeunesOrphelinsMigrationCommand {
  idPopulationQuiMigre: string
}

@Injectable()
export class RebasculerJeunesOrphelinsMigrationCommandHandler extends CommandHandler<
  RebasculerJeunesOrphelinsMigrationCommand,
  void
> {
  constructor(
    private readonly migrationService: Migration.Service,
    @Inject(MigrationRepositoryToken)
    private readonly migrationRepository: Migration.Repository
  ) {
    super('RebasculerJeunesOrphelinsMigrationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(
    command: RebasculerJeunesOrphelinsMigrationCommand
  ): Promise<Result> {
    const migrationExiste =
      await this.migrationRepository.populationConcerneeParUneMigration(
        command.idPopulationQuiMigre
      )
    if (!migrationExiste) {
      return failure(
        new NonTrouveError('Migration', command.idPopulationQuiMigre)
      )
    }

    const rebasculements = await this.migrationService.rebasculerOrphelins(
      command.idPopulationQuiMigre
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
        idPopulationQuiMigre: command.idPopulationQuiMigre,
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

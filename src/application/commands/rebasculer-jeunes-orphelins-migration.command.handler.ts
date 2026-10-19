import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Migration, MigrationRepositoryToken } from '../../domain/migration'
import { rootLogger } from '../../utils/logger.module'

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
        rootLogger.info(
          {
            context: 'RebasculerJeunesOrphelinsMigrationCommandHandler',
            labels: {
              population_id: command.idPopulationQuiMigre,
              jeune_id: idJeune,
              ancien_conseiller_id: ancienIdConseiller,
              nouveau_conseiller_id: nouveauIdConseiller
            }
          },
          'Jeune orphelin rebasculé vers son conseiller initial'
        )
    )
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  protected labelsDuLog(
    _result: Result,
    command?: RebasculerJeunesOrphelinsMigrationCommand
  ): Record<string, string | string[]> | undefined {
    return command && { population_id: command.idPopulationQuiMigre }
  }
}

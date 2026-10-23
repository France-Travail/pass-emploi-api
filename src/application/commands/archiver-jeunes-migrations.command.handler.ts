import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Migration, MigrationRepositoryToken } from '../../domain/migration'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../domain/planificateur'
import { DateService } from '../../utils/date-service'

export interface ArchiverJeunesMigrationCommand {
  idPopulationQuiMigre: string
}

@Injectable()
export class ArchiverJeunesMigrationCommandHandler extends CommandHandler<
  ArchiverJeunesMigrationCommand,
  void
> {
  constructor(
    @Inject(MigrationRepositoryToken)
    private readonly migrationRepository: Migration.Repository,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('ArchiverJeunesMigrationCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(command: ArchiverJeunesMigrationCommand): Promise<Result> {
    const migrationExiste =
      await this.migrationRepository.populationConcerneeParUneMigration(
        command.idPopulationQuiMigre
      )
    if (!migrationExiste) {
      return failure(
        new NonTrouveError('Migration', command.idPopulationQuiMigre)
      )
    }

    await this.planificateurRepository.ajouterJob<Planificateur.JobArchiverJeunesMigration>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
        contenu: { idPopulation: command.idPopulationQuiMigre }
      }
    )

    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  protected labelsDuLog(
    _result: Result,
    command?: ArchiverJeunesMigrationCommand
  ): Record<string, string | string[]> | undefined {
    return command && { population_id: command.idPopulationQuiMigre }
  }
}

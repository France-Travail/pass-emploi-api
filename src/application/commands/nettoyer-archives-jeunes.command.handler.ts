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

export interface NettoyerArchivesJeunesCommand {
  idPopulationQuiMigre: string
}

@Injectable()
export class NettoyerArchivesJeunesCommandHandler extends CommandHandler<
  NettoyerArchivesJeunesCommand,
  void
> {
  constructor(
    @Inject(MigrationRepositoryToken)
    private readonly migrationRepository: Migration.Repository,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('NettoyerArchivesJeunesCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(command: NettoyerArchivesJeunesCommand): Promise<Result> {
    const migrationExiste =
      await this.migrationRepository.populationConcerneeParUneMigration(
        command.idPopulationQuiMigre
      )
    if (!migrationExiste) {
      return failure(
        new NonTrouveError('Migration', command.idPopulationQuiMigre)
      )
    }

    await this.planificateurRepository.ajouterJob<Planificateur.JobNettoyerArchivesJeunes>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
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
    command?: NettoyerArchivesJeunesCommand
  ): Record<string, string | string[]> | undefined {
    return command && { population_id: command.idPopulationQuiMigre }
  }
}

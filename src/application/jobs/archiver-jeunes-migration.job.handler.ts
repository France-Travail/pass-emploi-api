import { Inject, Injectable } from '@nestjs/common'
import {
  BilanLot,
  JobParLotsHandler
} from '../../building-blocks/types/job-par-lots-handler'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Migration } from '../../domain/migration'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport

export const TAILLE_LOT_ARCHIVAGE_MIGRATION = 100

const COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT =
  "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."

@Injectable()
@ProcessJobType(Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION)
export class ArchiverJeunesMigrationJobHandler extends JobParLotsHandler<Planificateur.JobArchiverJeunesMigration> {
  protected readonly tailleLot = TAILLE_LOT_ARCHIVAGE_MIGRATION

  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    planificateurRepository: Planificateur.Repository,
    private readonly migrationService: Migration.Service,
    private readonly archiveJeuneService: ArchiveJeune.Service
  ) {
    super(
      Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
      suiviJobService,
      planificateurRepository,
      dateService
    )
  }

  protected labelsDuLog(
    job: Planificateur.Job<Planificateur.JobArchiverJeunesMigration>
  ): Record<string, string | string[]> | undefined {
    return job.contenu && { population_id: job.contenu.idPopulation }
  }

  protected async recupererLot(
    contenu: Planificateur.JobArchiverJeunesMigration,
    taille: number
  ): Promise<string[]> {
    const ids = await this.migrationService.recupererIdsDesBeneficiaireAMigrer(
      contenu.idPopulation
    )
    return ids
      .toSorted((a, b) => a.localeCompare(b))
      .filter(id => !contenu.apresId || id > contenu.apresId)
      .slice(0, taille)
  }

  protected async traiterLot(
    contenu: Planificateur.JobArchiverJeunesMigration,
    ids: string[]
  ): Promise<BilanLot> {
    const idsArchives = await this.archiverLeLot(ids, contenu.idPopulation)
    return {
      nbTraites: idsArchives.length,
      nbEchecs: ids.length - idsArchives.length
    }
  }

  private async archiverLeLot(
    ids: string[],
    idPopulation: string
  ): Promise<string[]> {
    try {
      return await this.archiverEnMasse(ids, idPopulation)
    } catch (e) {
      this.loguerEchecDuLot(idPopulation, e)
      return this.archiverUnParUn(ids, idPopulation)
    }
  }

  private async archiverEnMasse(
    idsJeunes: string[],
    idPopulation: string
  ): Promise<string[]> {
    const resultat = await this.archiveJeuneService.archiverEnMasse(
      idsJeunes,
      COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT,
      MotifSuppressionSupport.MIGRATION,
      idPopulation
    )
    return resultat.idsJeunesArchives
  }

  private async archiverUnParUn(
    lot: string[],
    idPopulation: string
  ): Promise<string[]> {
    const idsArchives: string[] = []
    for (const idJeune of lot) {
      try {
        const idsArchivesDuJeune = await this.archiverEnMasse(
          [idJeune],
          idPopulation
        )
        idsArchives.push(...idsArchivesDuJeune)
      } catch (e) {
        this.loguerEchecDuJeune(idPopulation, idJeune, e)
      }
    }
    return idsArchives
  }

  private loguerEchecDuLot(idPopulation: string, error: unknown): void {
    rootLogger.error(
      {
        context: this.jobType,
        labels: { population_id: idPopulation },
        error: toEcsError(error)
      },
      "Échec de l'archivage d'un lot de la migration, reprise jeune par jeune"
    )
  }

  private loguerEchecDuJeune(
    idPopulation: string,
    idJeune: string,
    error: unknown
  ): void {
    rootLogger.error(
      {
        context: this.jobType,
        labels: { population_id: idPopulation, jeune_id: idJeune },
        error: toEcsError(error)
      },
      "Échec de l'archivage d'un jeune de la migration"
    )
  }
}

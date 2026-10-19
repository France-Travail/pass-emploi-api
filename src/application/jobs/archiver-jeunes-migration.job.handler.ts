import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../building-blocks/types/job-handler'
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
export const LOTS_EN_ECHEC_CONSECUTIFS_MAX = 3

const COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT =
  "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."

@Injectable()
@ProcessJobType(Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION)
export class ArchiverJeunesMigrationJobHandler extends JobHandler<Planificateur.JobArchiverJeunesMigration> {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly migrationService: Migration.Service,
    private readonly archiveJeuneService: ArchiveJeune.Service
  ) {
    super(Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION, suiviJobService)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobArchiverJeunesMigration>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { idPopulation } = job.contenu!
    const idsDejaEnEchec = job.contenu!.idsEnEchec ?? []

    const idsAArchiver = (
      await this.migrationService.recupererIdsDesBeneficiaireAMigrer(
        idPopulation
      )
    ).filter(idJeune => !idsDejaEnEchec.includes(idJeune))
    const lot = idsAArchiver.slice(0, TAILLE_LOT_ARCHIVAGE_MIGRATION)

    const { idsArchives, nbEchecsNettoyage } = await this.archiverLeLot(
      lot,
      idPopulation
    )
    const idsNonArchives = lot.filter(id => !idsArchives.includes(id))
    const lotEnEchec = lot.length > 0 && idsArchives.length === 0

    const idsEnEchec = [...idsDejaEnEchec, ...idsNonArchives]
    const nbArchives = (job.contenu!.nbArchives ?? 0) + idsArchives.length
    const lotsEnEchecConsecutifs = lotEnEchec
      ? (job.contenu!.lotsEnEchecConsecutifs ?? 0) + 1
      : 0
    const nbRestants = idsAArchiver.length - lot.length
    const abandonne = lotsEnEchecConsecutifs >= LOTS_EN_ECHEC_CONSECUTIFS_MAX
    const termine = nbRestants === 0

    if (!termine && !abandonne) {
      await this.planificateurRepository.ajouterJob<Planificateur.JobArchiverJeunesMigration>(
        {
          dateExecution: this.dateService.nowJs(),
          type: Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
          contenu: {
            idPopulation,
            idsEnEchec,
            nbArchives,
            lotsEnEchecConsecutifs
          }
        }
      )
    }

    return {
      jobType: this.jobType,
      dateExecution: maintenant,
      succes: !lotEnEchec,
      resultat: {
        idPopulation,
        nbArchivesDuLot: idsArchives.length,
        nbEchecsDuLot: idsNonArchives.length,
        nbEchecsNettoyageDuLot: nbEchecsNettoyage,
        nbArchives,
        nbEchecs: idsEnEchec.length,
        nbRestants,
        termine,
        abandonne,
        idsEnEchec
      },
      nbErreurs: idsNonArchives.length + nbEchecsNettoyage,
      tempsExecution: DateService.calculerTempsExecution(maintenant)
    }
  }

  protected labelsDuLog(
    job: Planificateur.Job<Planificateur.JobArchiverJeunesMigration>
  ): Record<string, string | string[]> | undefined {
    return job.contenu && { population_id: job.contenu.idPopulation }
  }

  private async archiverLeLot(
    lot: string[],
    idPopulation: string
  ): Promise<{ idsArchives: string[]; nbEchecsNettoyage: number }> {
    try {
      const resultat = await this.archiver(lot, idPopulation)
      return {
        idsArchives: resultat.idsJeunesArchives,
        nbEchecsNettoyage: resultat.nbEchecsNettoyage
      }
    } catch (e) {
      this.loguerEchecDuLot(idPopulation, e)
      return this.archiverUnParUn(lot, idPopulation)
    }
  }

  // Une seule donnée invalide fait échouer tout le lot : on le rejoue jeune par
  // jeune pour n'écarter que les jeunes réellement en erreur.
  private async archiverUnParUn(
    lot: string[],
    idPopulation: string
  ): Promise<{ idsArchives: string[]; nbEchecsNettoyage: number }> {
    const idsArchives: string[] = []
    let nbEchecsNettoyage = 0
    for (const idJeune of lot) {
      try {
        const resultat = await this.archiver([idJeune], idPopulation)
        idsArchives.push(...resultat.idsJeunesArchives)
        nbEchecsNettoyage += resultat.nbEchecsNettoyage
      } catch (e) {
        this.loguerEchecDuJeune(idPopulation, idJeune, e)
      }
    }
    return { idsArchives, nbEchecsNettoyage }
  }

  private archiver(
    idsJeunes: string[],
    idPopulation: string
  ): Promise<ArchiveJeune.ResultatArchivageEnMasse> {
    return this.archiveJeuneService.archiverEnMasse(
      idsJeunes,
      COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT,
      MotifSuppressionSupport.MIGRATION,
      idPopulation
    )
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

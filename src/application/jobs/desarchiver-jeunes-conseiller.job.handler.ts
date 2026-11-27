import { Inject, Injectable } from '@nestjs/common'
import {
  BilanLot,
  JobParLotsHandler
} from '../../building-blocks/types/job-par-lots-handler'
import { DomainError } from '../../building-blocks/types/domain-error'
import { isSuccess } from '../../building-blocks/types/result'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../domain/archive-jeune'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'
import { DesarchivageJeuneService } from '../commands/support/desarchivage-jeune.service.db'

export const TAILLE_LOT_DESARCHIVAGE = 10

@Injectable()
@ProcessJobType(Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER)
export class DesarchiverJeunesConseillerJobHandler extends JobParLotsHandler<Planificateur.JobDesarchiverJeunesConseiller> {
  protected readonly tailleLot = TAILLE_LOT_DESARCHIVAGE

  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    planificateurRepository: Planificateur.Repository,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    private readonly desarchivageService: DesarchivageJeuneService
  ) {
    super(
      Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER,
      suiviJobService,
      planificateurRepository,
      dateService
    )
  }

  protected labelsDuLog(
    job: Planificateur.Job<Planificateur.JobDesarchiverJeunesConseiller>
  ): Record<string, string | string[]> | undefined {
    return job.contenu && { conseiller_id: job.contenu.idConseiller }
  }

  protected async recupererLot(
    contenu: Planificateur.JobDesarchiverJeunesConseiller,
    taille: number
  ): Promise<string[]> {
    const ids =
      await this.archiveJeuneRepository.idsArchivesMigrationDuConseiller({
        idConseiller: contenu.idConseiller,
        taille,
        apresId: contenu.apresId ? Number(contenu.apresId) : undefined
      })
    return ids.map(String)
  }

  protected async traiterLot(
    contenu: Planificateur.JobDesarchiverJeunesConseiller,
    ids: string[]
  ): Promise<BilanLot> {
    const bilan = { nbTraites: 0, nbEchecs: 0, nbIgnores: 0 }
    for (const idArchive of ids) {
      try {
        const result = await this.desarchivageService.desarchiver(
          Number(idArchive),
          contenu.idConseiller
        )
        if (isSuccess(result)) {
          bilan.nbTraites++
        } else {
          bilan.nbIgnores++
          this.loguerArchiveIgnoree(
            contenu.idConseiller,
            idArchive,
            result.error
          )
        }
      } catch (e) {
        bilan.nbEchecs++
        this.loguerEchec(contenu.idConseiller, idArchive, e)
      }
    }
    return bilan
  }

  private loguerArchiveIgnoree(
    idConseiller: string,
    idArchive: string,
    raison: DomainError
  ): void {
    rootLogger.info(
      {
        context: this.jobType,
        event: { action: 'archive_non_desarchivee', outcome: 'failure' },
        labels: { conseiller_id: idConseiller, archive_id: idArchive },
        error: toEcsError(raison)
      },
      'archive_non_desarchivee'
    )
  }

  private loguerEchec(
    idConseiller: string,
    idArchive: string,
    erreur: unknown
  ): void {
    rootLogger.error(
      {
        context: this.jobType,
        event: { action: 'desarchivage_echoue', outcome: 'failure' },
        labels: { conseiller_id: idConseiller, archive_id: idArchive },
        error: toEcsError(erreur)
      },
      'desarchivage_echoue'
    )
  }
}

import { Inject, Injectable } from '@nestjs/common'
import {
  BilanLot,
  JobParLotsHandler
} from '../../building-blocks/types/job-par-lots-handler'
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

export const TAILLE_LOT_NETTOYAGE_ARCHIVES = 10

@Injectable()
@ProcessJobType(Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES)
export class NettoyerArchivesJeunesJobHandler extends JobParLotsHandler<Planificateur.JobNettoyerArchivesJeunes> {
  protected readonly tailleLot = TAILLE_LOT_NETTOYAGE_ARCHIVES

  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    planificateurRepository: Planificateur.Repository,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    private readonly archiveJeuneService: ArchiveJeune.Service
  ) {
    super(
      Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
      suiviJobService,
      planificateurRepository,
      dateService
    )
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobNettoyerArchivesJeunes>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const contenu = job.contenu ?? {}
    if (
      !contenu.apresId &&
      (await this.planificateurRepository.chaineDeLotsEnCours(this.jobType))
    ) {
      return {
        jobType: this.jobType,
        dateExecution: maintenant,
        succes: true,
        resultat: { chaineDejaEnCours: true },
        nbErreurs: 0,
        tempsExecution: DateService.calculerTempsExecution(maintenant),
        intermediaire: false
      }
    }
    return super.handle({ ...job, contenu })
  }

  protected labelsDuLog(
    job: Planificateur.Job<Planificateur.JobNettoyerArchivesJeunes>
  ): Record<string, string | string[]> | undefined {
    const idPopulation = job.contenu?.idPopulation
    return idPopulation ? { population_id: idPopulation } : undefined
  }

  protected async recupererLot(
    contenu: Planificateur.JobNettoyerArchivesJeunes,
    taille: number
  ): Promise<string[]> {
    const ids = await this.archiveJeuneRepository.idsArchivesANettoyer({
      taille,
      apresId: contenu.apresId ? Number(contenu.apresId) : undefined,
      idPopulation: contenu.idPopulation
    })
    return ids.map(String)
  }

  protected async traiterLot(
    _contenu: Planificateur.JobNettoyerArchivesJeunes,
    ids: string[]
  ): Promise<BilanLot> {
    const bilan = await this.archiveJeuneService.nettoyerLesArchives(
      ids.map(Number)
    )
    return { ...bilan }
  }
}

import { JobHandler } from './job-handler'
import { Planificateur } from '../../domain/planificateur'
import { SuiviJob } from '../../domain/suivi-job'
import { getWorkerTrackingServiceInstance } from '../../infrastructure/monitoring/worker.tracking.service'
import { DateService } from '../../utils/date-service'
import JobType = Planificateur.JobType

export interface ContenuJobParLots {
  apresId?: string
  jobRunId?: string
  cumul?: BilanLot
}

export interface BilanLot {
  nbTraites: number
  nbEchecs: number
  [compteur: string]: number
}

export abstract class JobParLotsHandler<
  TContenu extends ContenuJobParLots
> extends JobHandler<TContenu> {
  protected abstract readonly tailleLot: number

  constructor(
    jobType: JobType,
    suiviJobService: SuiviJob.Service,
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super(jobType, suiviJobService)
  }

  async handle(job: Planificateur.Job<TContenu>): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const contenu = job.contenu!
    const jobRunId = reprendreLeJobRunId(contenu.jobRunId)
    let cumul = contenu.cumul

    try {
      const lot = await this.recupererLot(contenu, this.tailleLot)
      const bilanDuLot = await this.traiterLot(contenu, lot)
      cumul = cumuler(cumul, bilanDuLot)
      const termine = lot.length < this.tailleLot

      if (!termine) {
        await this.planificateurRepository.ajouterJob<TContenu>({
          dateExecution: this.dateService.nowJs(),
          type: this.jobType,
          contenu: { ...contenu, apresId: lot.at(-1), jobRunId, cumul }
        })
      }

      const bilan = termine ? cumul : bilanDuLot
      return {
        jobType: this.jobType,
        dateExecution: maintenant,
        succes: bilan.nbEchecs === 0,
        resultat: { ...cumul, termine },
        nbErreurs: bilan.nbEchecs,
        tempsExecution: DateService.calculerTempsExecution(maintenant),
        intermediaire: !termine
      }
    } catch (e) {
      return {
        jobType: this.jobType,
        dateExecution: maintenant,
        succes: false,
        resultat: { ...cumul, termine: false },
        nbErreurs: cumul?.nbEchecs ?? 0,
        tempsExecution: DateService.calculerTempsExecution(maintenant),
        erreur: e
      }
    }
  }

  protected abstract recupererLot(
    contenu: TContenu,
    taille: number
  ): Promise<string[]>

  protected abstract traiterLot(
    contenu: TContenu,
    ids: string[]
  ): Promise<BilanLot>
}

function reprendreLeJobRunId(
  jobRunIdDuPremierLot: string | undefined
): string | undefined {
  const workerTrackingService = getWorkerTrackingServiceInstance()
  if (jobRunIdDuPremierLot) {
    workerTrackingService.remplacerJobRunId(jobRunIdDuPremierLot)
  }
  return workerTrackingService.getCurrentJobTracking().jobRunId
}

function cumuler(cumul: BilanLot | undefined, bilanDuLot: BilanLot): BilanLot {
  if (!cumul) return bilanDuLot
  return Object.fromEntries(
    Object.entries(bilanDuLot).map(([compteur, valeur]) => [
      compteur,
      (cumul[compteur] ?? 0) + valeur
    ])
  ) as BilanLot
}

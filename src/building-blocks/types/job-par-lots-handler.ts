import { JobHandler } from './job-handler'
import { Planificateur } from '../../domain/planificateur'
import { SuiviJob } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import JobType = Planificateur.JobType

export interface ContenuJobParLots {
  apresId?: string
}

export interface BilanLot {
  nbTraites: number
  nbEchecs: number
}

// @todo: migrer les jobs actuels qui fonctionnent par lots sur ce handler
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
    const lot = await this.recupererLot(contenu, this.tailleLot)
    const bilan = await this.traiterLot(contenu, lot)
    const termine = lot.length < this.tailleLot

    if (!termine) {
      await this.planificateurRepository.ajouterJob<TContenu>({
        dateExecution: this.dateService.nowJs(),
        type: this.jobType,
        contenu: { ...contenu, apresId: lot.at(-1) }
      })
    }

    return {
      jobType: this.jobType,
      dateExecution: maintenant,
      succes: bilan.nbEchecs === 0,
      resultat: { ...bilan, termine },
      nbErreurs: bilan.nbEchecs,
      tempsExecution: DateService.calculerTempsExecution(maintenant)
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

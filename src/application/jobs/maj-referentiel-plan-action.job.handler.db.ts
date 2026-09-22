import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { GristClient } from '../../infrastructure/clients/grist-client'
import { DateService } from '../../utils/date-service'
import { reconcilierReferentiel } from './mappers/referentiel-plan-action.mapper'

export interface StatsMajReferentielPlanAction {
  dryRun: boolean
  nbServices: number
  nbSolutions: number
  nbCreees: number
  nbMisesAJour: number
  nbDesactivees: number
  nbServicesNonResolus: number
  nbDoublonsServices: number
  nbDoublonsSolutions: number
  nbSolutionsEcartees: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION)
export class MajReferentielPlanActionJobHandler extends JobHandler<void> {
  constructor(
    private readonly gristClient: GristClient,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION, suiviJobService)
  }

  async handle(_job: Planificateur.Job<void>): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').majReferentielPlanAction
    const stats: StatsMajReferentielPlanAction = {
      dryRun: config.dryRun,
      nbServices: 0,
      nbSolutions: 0,
      nbCreees: 0,
      nbMisesAJour: 0,
      nbDesactivees: 0,
      nbServicesNonResolus: 0,
      nbDoublonsServices: 0,
      nbDoublonsSolutions: 0,
      nbSolutionsEcartees: 0
    }
    let succes = true

    try {
      const servicesResult = await this.gristClient.recupererServices()
      if (isFailure(servicesResult)) {
        throw new Error(
          `Lecture des services Grist échouée : ${servicesResult.error.message}`
        )
      }

      const solutionsResult = await this.gristClient.recupererSolutions()
      if (isFailure(solutionsResult)) {
        throw new Error(
          `Lecture des solutions Grist échouée : ${solutionsResult.error.message}`
        )
      }
      if (solutionsResult.data.length === 0) {
        throw new Error("Le référentiel Grist du plan d'action est vide")
      }

      const reconciliation = reconcilierReferentiel(
        servicesResult.data,
        solutionsResult.data
      )

      stats.nbServices = reconciliation.services.length
      stats.nbSolutions = reconciliation.solutions.length
      stats.nbServicesNonResolus = reconciliation.anomalies.nbServicesNonResolus
      stats.nbDoublonsServices = reconciliation.anomalies.nbDoublonsServices
      stats.nbDoublonsSolutions = reconciliation.anomalies.nbDoublonsSolutions
      stats.nbSolutionsEcartees = reconciliation.anomalies.nbSolutionsEcartees

      if (!config.dryRun) {
        const diff = await this.referentielRepository.remplacer(
          reconciliation.services,
          reconciliation.solutions,
          {
            pourcentageMax: parseInt(config.pourcentageDesactivationsMax, 10),
            nombreMin: parseInt(config.nombreDesactivationsMin, 10)
          }
        )
        stats.nbCreees = diff.nbCreees
        stats.nbMisesAJour = diff.nbMisesAJour
        stats.nbDesactivees = diff.nbDesactivees
      }
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: succes ? 0 : 1,
      succes,
      dateExecution: debutExecutionJob,
      tempsExecution: DateService.calculerTempsExecution(debutExecutionJob),
      resultat: stats
    }
  }
}

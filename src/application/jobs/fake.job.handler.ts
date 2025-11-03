import { Inject, Injectable } from '@nestjs/common'
import { DateService } from '../../utils/date-service'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'

@Injectable()
@ProcessJobType(Planificateur.JobType.FAKE)
export class FakeJobHandler extends JobHandler<Planificateur.JobFake> {
  constructor(
    private readonly dateService: DateService,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service
  ) {
    super(Planificateur.JobType.FAKE, suiviJobService)
  }

  async handle(
    job?: Planificateur.Job<Planificateur.JobFake>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    this.logger.log({
      job,
      msg: 'executed'
    })
    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: true,
      dateExecution: maintenant,
      tempsExecution: maintenant.diffNow().milliseconds * -1,
      resultat: {}
    }
  }
}

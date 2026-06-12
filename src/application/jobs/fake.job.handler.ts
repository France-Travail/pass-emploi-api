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
    job: Planificateur.Job<Planificateur.JobFake>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    this.logger.log({
      job,
      msg: 'executed'
    })

    // ⚠️⚠️ TEST TEMPORAIRE — À RETIRER ⚠️⚠️
    // Échec volontaire pour vérifier que la notif d'erreur Mattermost fonctionne
    // (commit "amelio notif job mattermost" : l'erreur remonte -> notifierResultatJob).
    // Variante A (active) : exception non catchée -> gérée par JobHandler.execute().
    // Variante B : commenter le throw et décommenter le `return` "erreur catchée" plus bas.
    if (job.type === Planificateur.JobType.FAKE) {
      throw new Error('[TEST MATTERMOST] echec volontaire du FAKE job')
    }
    // return {
    //   jobType: this.jobType,
    //   nbErreurs: 1,
    //   succes: false,
    //   dateExecution: maintenant,
    //   tempsExecution: maintenant.diffNow().milliseconds * -1,
    //   resultat: { message: 'echec catche volontaire' },
    //   erreur: new Error('[TEST MATTERMOST] echec catche volontaire du FAKE job')
    // }
    // ⚠️⚠️ FIN TEST TEMPORAIRE ⚠️⚠️

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

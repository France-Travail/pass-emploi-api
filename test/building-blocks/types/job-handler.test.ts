import { DateTime } from 'luxon'
import * as sinon from 'sinon'
import { JobHandler } from '../../../src/building-blocks/types/job-handler'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { rootLogger } from '../../../src/utils/logger.module'
import { expect } from '../../utils'

class UnJobHandler extends JobHandler {
  constructor(suiviJobService: SuiviJob.Service) {
    super(Planificateur.JobType.NETTOYER_LES_DONNEES, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    return {
      jobType: Planificateur.JobType.NETTOYER_LES_DONNEES,
      dateExecution: DateTime.fromISO('2026-11-24T10:11:06Z'),
      succes: true,
      resultat: {},
      nbErreurs: 0,
      tempsExecution: 0
    }
  }
}

describe('JobHandler', () => {
  let logInfo: sinon.SinonStub
  let logError: sinon.SinonStub

  beforeEach(() => {
    logInfo = sinon.stub(rootLogger, 'info')
    logError = sinon.stub(rootLogger, 'error')
  })

  afterEach(() => {
    logInfo.restore()
    logError.restore()
  })

  it("termine le job et logue l'échec quand l'enregistrement du suivi échoue", async () => {
    // Given
    const suiviJobService: SuiviJob.Service = {
      save: sinon.stub().rejects(new Error('Operation timeout')),
      notifierResultatJob: sinon.stub().resolves(),
      envoyerRapport: sinon.stub().resolves()
    }
    const handler = new UnJobHandler(suiviJobService)

    // When
    const suiviJob = await handler.execute({
      type: Planificateur.JobType.NETTOYER_LES_DONNEES,
      dateExecution: new Date('2026-11-24T10:11:06Z')
    })
    await new Promise(resolve => setImmediate(resolve))

    // Then
    expect(suiviJob?.succes).to.be.true()
    expect(logError).to.have.been.calledWithMatch(
      { context: Planificateur.JobType.NETTOYER_LES_DONNEES },
      "L'enregistrement du suivi du job a échoué"
    )
  })
})

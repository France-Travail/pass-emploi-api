import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import * as childProcess from 'node:child_process'
import { SinonSandbox, SinonStub } from 'sinon'
import { DumpForAnalyticsJobHandler } from '../../../../src/application/jobs/analytics/0-dump-for-analytics.job'
import { Planificateur } from '../../../../src/domain/planificateur'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { DateService } from '../../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('DumpForAnalyticsJobHandler', () => {
  let sandbox: SinonSandbox
  let handler: DumpForAnalyticsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  let exec: SinonStub
  const maintenant = DateTime.fromISO('2026-09-17T02:30:00.000Z')

  beforeEach(() => {
    sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())
    exec = sandbox
      .stub(childProcess, 'exec')
      .yields(null, { stdout: 'dump OK', stderr: '' })
    handler = new DumpForAnalyticsJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('lance le dump puis enfile le chargement des événements et des populations', async () => {
    // When
    const suiviJob = await handler.handle()

    // Then
    expect(suiviJob.succes).to.equal(true)
    expect(exec).to.have.been.calledOnce()
    expect(planificateurRepository.ajouterJob).to.have.been.calledTwice()
    expect(planificateurRepository.ajouterJob).to.have.been.calledWithExactly({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.CHARGER_EVENEMENTS_ANALYTICS,
      contenu: undefined
    })
    expect(planificateurRepository.ajouterJob).to.have.been.calledWithExactly({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS,
      contenu: undefined
    })
  })
})

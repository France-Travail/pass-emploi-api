import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import * as childProcess from 'node:child_process'
import { SinonSandbox, SinonStub } from 'sinon'
import { DumpPopulationsForAnalyticsJobHandler } from '../../../../src/application/jobs/analytics/0-dump-populations-for-analytics.job'
import { Planificateur } from '../../../../src/domain/planificateur'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { DateService } from '../../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('DumpPopulationsForAnalyticsJobHandler', () => {
  let sandbox: SinonSandbox
  let handler: DumpPopulationsForAnalyticsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  let exec: SinonStub
  const maintenant = DateTime.fromISO('2026-09-21T10:00:00.000Z')

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
    handler = new DumpPopulationsForAnalyticsJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('ne dumpe que les tables de populations puis enfile le chargement des populations', async () => {
    // When
    const suiviJob = await handler.handle()

    // Then
    expect(suiviJob.succes).to.equal(true)
    expect(exec).to.have.been.calledOnce()
    expect(exec.firstCall.args[1].env.DUMP_TABLES).to.equal(
      'fonctionnalite population population_conseiller population_profil population_structure_milo population_agence_ft deploiement communication communication_envoi'
    )
    expect(
      planificateurRepository.ajouterJob
    ).to.have.been.calledOnceWithExactly({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS,
      contenu: undefined
    })
  })

  it('remonte un échec quand le dump écrit sur stderr, mais enfile quand même le chargement', async () => {
    // Given
    exec.yields(null, { stdout: '', stderr: 'pg_dump: error' })

    // When
    const suiviJob = await handler.handle()

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
  })
})

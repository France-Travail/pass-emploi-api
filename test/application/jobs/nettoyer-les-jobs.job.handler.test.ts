import { NettoyerLesJobsJobHandler } from '../../../src/application/jobs/nettoyer-les-jobs.job.handler'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { Planificateur } from '../../../src/domain/planificateur'
import { NettoyageJobsStats, SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'

describe('NettoyerLesJobsJobHandler', () => {
  let sandbox: SinonSandbox
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let handler: NettoyerLesJobsJobHandler

  beforeEach(() => {
    sandbox = createSandbox()
    planificateurRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    suiviJobService = stubInterface(sandbox)
    handler = new NettoyerLesJobsJobHandler(
      planificateurRepository,
      dateService,
      suiviJobService
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it('nettoie les jobs complétés et en échec et retourne les stats', async () => {
      // Given
      const stats: NettoyageJobsStats = {
        nbJobsNettoyes: 5,
        nbJobsEnEchecNettoyes: 3
      }
      planificateurRepository.supprimerLesJobsPasses.resolves(stats)

      // When
      const result = await handler.handle()

      // Then
      expect(planificateurRepository.supprimerLesJobsPasses).to.have.callCount(
        1
      )
      expect(result.succes).to.be.true()
      expect(result.nbErreurs).to.equal(0)
      expect(result.resultat).to.deep.equal(stats)
    })

    it('retourne un échec si la suppression lève une erreur', async () => {
      // Given
      const erreur = new Error('Redis indisponible')
      planificateurRepository.supprimerLesJobsPasses.rejects(erreur)

      // When
      const result = await handler.handle()

      // Then
      expect(result.succes).to.be.false()
      expect(result.nbErreurs).to.equal(1)
      expect(result.erreur).to.equal(erreur)
      expect(result.resultat).to.equal(erreur)
    })
  })
})

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { NotifierNouvellesImmersionsCommandHandler } from '../../../src/application/commands/notifier-nouvelles-immersions.command.handler'
import { Planificateur } from '../../../src/domain/planificateur'
import { DateService } from '../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { uneNouvelleImmersionCommand } from '../../fixtures/offre-immersion.fixture'

describe('NotifierNouvellesImmersionsCommandHandler', () => {
  let notifierNouvellesImmersionsCommandHandler: NotifierNouvellesImmersionsCommandHandler
  const sandbox: SinonSandbox = createSandbox()
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  const maintenant = new Date('2026-11-26T14:01:23Z')

  beforeEach(async () => {
    planificateurRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)
    notifierNouvellesImmersionsCommandHandler =
      new NotifierNouvellesImmersionsCommandHandler(
        planificateurRepository,
        dateService
      )
  })

  describe('handle', () => {
    it('planifie un job de notification avec les immersions reçues', async () => {
      // Given
      const command = uneNouvelleImmersionCommand()

      // When
      await notifierNouvellesImmersionsCommandHandler.handle(command)

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledWithExactly(
        {
          dateExecution: maintenant,
          type: Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS,
          contenu: { immersions: command.immersions }
        }
      )
    })
  })
})

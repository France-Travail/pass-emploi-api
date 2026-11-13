import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { DeconnecterJeunesDispositifCommandHandler } from '../../../../src/application/commands/support/deconnecter-jeunes-dispositif.command.handler'
import { isSuccess } from '../../../../src/building-blocks/types/result'
import { Authentification } from '../../../../src/domain/authentification'
import { Planificateur } from '../../../../src/domain/planificateur'
import { Profil } from '../../../../src/domain/profil'
import { DateService } from '../../../../src/utils/date-service'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('DeconnecterJeunesDispositifCommandHandler', () => {
  let handler: DeconnecterJeunesDispositifCommandHandler
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>

  const maintenant = new Date('2026-11-04T03:24:00Z')

  beforeEach(() => {
    planificateurRepository =
      stubInterface<Planificateur.Repository>(createSandbox())
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)

    handler = new DeconnecterJeunesDispositifCommandHandler(
      planificateurRepository,
      dateService
    )
  })

  it('planifie le job avec le dispositif', async () => {
    // When
    const result = await handler.execute(
      { dispositif: Profil.Dispositif.AVENIR_PRO },
      Authentification.unUtilisateurSupport()
    )

    // Then
    expect(isSuccess(result)).to.be.true()
    expect(
      planificateurRepository.ajouterJob
    ).to.have.been.calledOnceWithExactly({
      dateExecution: maintenant,
      type: Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF,
      contenu: { dispositif: Profil.Dispositif.AVENIR_PRO }
    })
  })
})

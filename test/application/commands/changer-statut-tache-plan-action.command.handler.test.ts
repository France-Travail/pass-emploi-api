import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { ChangerStatutTachePlanActionCommandHandler } from '../../../src/application/commands/changer-statut-tache-plan-action.command.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('ChangerStatutTachePlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let dateService: StubbedClass<DateService>
  let handler: ChangerStatutTachePlanActionCommandHandler

  const dateCreation = uneDatetime()
  const maintenant = dateCreation.plus({ days: 2 })
  const utilisateur = unUtilisateurJeune()
  const idTache = '11111111-1111-1111-1111-111111111111'

  function uneTache(
    override: Partial<PlanAction.Tache> = {}
  ): PlanAction.Tache {
    return {
      id: idTache,
      idSolution: 'p-1',
      terminee: false,
      dateCreation,
      ...override
    }
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new ChangerStatutTachePlanActionCommandHandler(
      jeuneAuthorizer,
      planActionRepository,
      dateService,
      testConfig()
    )
  })

  it("n'est pas ouvert à l'invité", () => {
    expect(handler.profilsAutorises).to.deep.equal([...TOUT_PROFIL_SAUF_INVITE])
  })

  describe('authorize', () => {
    const command = { idJeune: utilisateur.id, idTache, terminee: true }

    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new ChangerStatutTachePlanActionCommandHandler(
        jeuneAuthorizer,
        planActionRepository,
        dateService,
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const result = await handlerDesactive.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it("délègue à l'autorisation jeune standard", async () => {
      // Given
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(command.idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    it('coche la tâche en datant sa complétion', async () => {
      // Given
      planActionRepository.getTache
        .withArgs(utilisateur.id, idTache)
        .resolves(uneTache())

      // When
      const result = await handler.handle({
        idJeune: utilisateur.id,
        idTache,
        terminee: true
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
        uneTache({ terminee: true, dateTerminee: maintenant })
      )
    })

    it('décoche la tâche en effaçant sa date de complétion', async () => {
      // Given
      planActionRepository.getTache
        .withArgs(utilisateur.id, idTache)
        .resolves(uneTache({ terminee: true, dateTerminee: dateCreation }))

      // When
      await handler.handle({
        idJeune: utilisateur.id,
        idTache,
        terminee: false
      })

      // Then
      expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
        uneTache({ terminee: false })
      )
    })

    it('conserve la date de complétion quand la tâche est déjà cochée', async () => {
      // Given
      planActionRepository.getTache
        .withArgs(utilisateur.id, idTache)
        .resolves(uneTache({ terminee: true, dateTerminee: dateCreation }))

      // When
      await handler.handle({
        idJeune: utilisateur.id,
        idTache,
        terminee: true
      })

      // Then
      expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
        uneTache({ terminee: true, dateTerminee: dateCreation })
      )
    })

    it("échoue quand la tâche n'appartient pas au plan du jeune", async () => {
      // Given
      planActionRepository.getTache
        .withArgs(utilisateur.id, idTache)
        .resolves(undefined)

      // When
      const result = await handler.handle({
        idJeune: utilisateur.id,
        idTache,
        terminee: true
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('TachePlanAction', idTache))
      )
      expect(planActionRepository.saveTache).not.to.have.been.called()
    })
  })
})

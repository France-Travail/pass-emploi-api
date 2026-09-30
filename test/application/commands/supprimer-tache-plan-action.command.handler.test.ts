import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { SupprimerTachePlanActionCommandHandler } from '../../../src/application/commands/supprimer-tache-plan-action.command.handler'
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

describe('SupprimerTachePlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let dateService: StubbedClass<DateService>
  let handler: SupprimerTachePlanActionCommandHandler

  const maintenant = uneDatetime().plus({ days: 2 })
  const utilisateur = unUtilisateurJeune()
  const idTache = '11111111-1111-1111-1111-111111111111'
  const command = { idJeune: utilisateur.id, idTache }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new SupprimerTachePlanActionCommandHandler(
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
    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new SupprimerTachePlanActionCommandHandler(
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
    it('marque la tâche du plan du jeune comme supprimée à la date du jour', async () => {
      // Given
      planActionRepository.getTache.withArgs(utilisateur.id, idTache).resolves({
        id: idTache,
        idSolution: 'p-1',
        terminee: false,
        dateCreation: uneDatetime()
      })

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        planActionRepository.supprimerTache
      ).to.have.been.calledWithExactly(idTache, maintenant)
    })

    it("échoue quand la tâche n'appartient pas au plan du jeune", async () => {
      // Given
      planActionRepository.getTache
        .withArgs(utilisateur.id, idTache)
        .resolves(undefined)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('TachePlanAction', idTache))
      )
      expect(planActionRepository.supprimerTache).not.to.have.been.called()
    })
  })
})

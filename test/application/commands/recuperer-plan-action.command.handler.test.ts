import { ConfigService } from '@nestjs/config'
import { RecupererPlanActionCommandHandler } from '../../../src/application/commands/recuperer-plan-action.command.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  DestinationActionPlan,
  TypeActionPlan
} from '../../../src/application/queries/query-models/plan-action.query-model'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { PlanActionSqlRepository } from '../../../src/infrastructure/repositories/plan-action/plan-action-sql.repository.db'
import { DISPOSITIFS_ACCOMPAGNES } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('RecupererPlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionSqlRepository: StubbedClass<PlanActionSqlRepository>
  let evenementService: StubbedClass<EvenementService>
  let handler: RecupererPlanActionCommandHandler

  const utilisateur = unUtilisateurJeune()
  const command = { idJeune: utilisateur.id }

  beforeEach(() => {
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionSqlRepository = stubClass(PlanActionSqlRepository)
    evenementService = stubClass(EvenementService)
    handler = new RecupererPlanActionCommandHandler(
      jeuneAuthorizer,
      planActionSqlRepository,
      evenementService,
      testConfig()
    )
  })

  describe('authorize', () => {
    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new RecupererPlanActionCommandHandler(
        jeuneAuthorizer,
        planActionSqlRepository,
        evenementService,
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
    it('renvoie le plan sauvegardé traduit en query model', async () => {
      // Given
      planActionSqlRepository.getDernierPlan
        .withArgs(command.idJeune)
        .resolves({
          id: 'plan-1',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'apprenticeship',
              actions: [
                {
                  id: 'tache-1',
                  libelle: "Je vais sur l'appli",
                  type: TypeActionPlan.NAVIGATION,
                  destination: DestinationActionPlan.EVENEMENTS
                }
              ]
            }
          ]
        })

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'apprenticeship',
              actions: [
                {
                  id: 'tache-1',
                  libelle: "Je vais sur l'appli",
                  type: TypeActionPlan.NAVIGATION,
                  destination: DestinationActionPlan.EVENEMENTS
                }
              ]
            }
          ]
        })
      )
    })

    it("renvoie une NonTrouveError quand le jeune n'a pas de plan sauvegardé", async () => {
      // Given
      planActionSqlRepository.getDernierPlan
        .withArgs(command.idJeune)
        .resolves(undefined)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('PlanAction', command.idJeune))
      )
    })
  })

  describe('monitor', () => {
    it("émet l'événement PLAN_ACTION_CONSULTATION", async () => {
      // When
      await handler.monitor(utilisateur)

      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.PLAN_ACTION_CONSULTATION,
        utilisateur
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal([
        ...DISPOSITIFS_ACCOMPAGNES
      ])
    })
  })
})

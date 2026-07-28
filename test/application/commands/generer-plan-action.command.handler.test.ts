import { GenererPlanActionCommandHandler } from '../../../src/application/commands/generer-plan-action.command.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { TypeActionPlan } from '../../../src/application/queries/query-models/plan-action.query-model'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import { Core } from '../../../src/domain/core'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { PlanDto } from '../../../src/infrastructure/clients/dto/plan-action.dto'
import { PlanActionClient } from '../../../src/infrastructure/clients/plan-action-client'
import {
  GoalPayload,
  SituationPayload
} from '../../../src/infrastructure/routes/validation/plan-action.inputs'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'

describe('GenererPlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let planActionClient: StubbedClass<PlanActionClient>
  let evenementService: StubbedClass<EvenementService>
  let handler: GenererPlanActionCommandHandler

  const utilisateur = unUtilisateurJeune({ structure: Core.Structure.INVITE })
  const command = {
    idJeune: utilisateur.id,
    payload: {
      situation: SituationPayload.LYCEE,
      goals: [GoalPayload.ALTERNANCE]
    }
  }

  beforeEach(() => {
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    planActionClient = stubClass(PlanActionClient)
    evenementService = stubClass(EvenementService)
    handler = new GenererPlanActionCommandHandler(
      jeuneAuthorizer,
      jeuneInviteAuthorizer,
      planActionClient,
      evenementService
    )
  })

  describe('authorize', () => {
    it("délègue à l'autorisation invité quand la structure est INVITE", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite
        .withArgs(command.idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
    })

    it("délègue à l'autorisation jeune standard pour un bénéficiaire accompagné", async () => {
      // Given
      const jeuneMilo = unUtilisateurJeune({ structure: Core.Structure.MILO })
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(command.idJeune, jeuneMilo)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(command, jeuneMilo)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(jeuneInviteAuthorizer.autoriserLInvite).not.to.have.been.called()
    })
  })

  describe('handle', () => {
    it('appelle le client avec le profil traduit et renvoie le plan traduit', async () => {
      // Given
      const plan: PlanDto = {
        id: 'plan-1',
        greeting: 'Salut !',
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'fallback',
        objectives: [
          {
            id: 'objective-1',
            title: 'Trouver une alternance',
            theme: 'apprenticeship',
            actions: [
              {
                id: 'p-1',
                label: 'Je fais une action',
                kind: 'advice',
                done: false
              }
            ]
          }
        ]
      }
      planActionClient.genererPlan.resolves(success(plan))

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionClient.genererPlan).to.have.been.calledWithMatch({
        authProvider: 'guest',
        situation: 'high-school',
        goals: ['apprenticeship']
      })
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          accroche: 'Salut !',
          genereLe: '2026-07-20T22:03:52.448Z',
          generateur: 'fallback',
          objectives: [
            {
              id: 'objective-1',
              titre: 'Trouver une alternance',
              theme: 'apprenticeship',
              actions: [
                {
                  id: 'p-1',
                  libelle: 'Je fais une action',
                  type: TypeActionPlan.CONSEIL
                }
              ]
            }
          ]
        })
      )
    })

    it('propage la failure du client sans la transformer', async () => {
      // Given
      const echec = failure(
        new ErreurHttp("La génération du plan d'action a échoué", 502)
      )
      planActionClient.genererPlan.resolves(echec)

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(echec)
    })
  })

  describe('monitor', () => {
    it("émet l'événement PLAN_ACTION_GENERE", async () => {
      // When
      await handler.monitor(utilisateur)

      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.PLAN_ACTION_GENERE,
        utilisateur
      )
    })
  })

  describe('execute — autorisation refusée', () => {
    it("n'appelle pas le client quand l'invité n'est pas autorisé", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const result = await handler.execute(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(planActionClient.genererPlan).not.to.have.been.called()
    })
  })
})

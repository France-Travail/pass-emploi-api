import { ConfigService } from '@nestjs/config'
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
import { Core } from '../../../src/domain/core'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { PlanAction } from '../../../src/domain/plan-action'
import {
  GoalPayload,
  SituationPayload
} from '../../../src/infrastructure/routes/validation/plan-action.inputs'
import { rootLogger } from '../../../src/utils/logger.module'
import { Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, sinon, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('GenererPlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let planActionService: StubbedClass<PlanAction.Service>
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

  function unPlan(args: Partial<PlanAction.Plan> = {}): PlanAction.Plan {
    return {
      id: 'plan-1',
      greeting: 'Salut !',
      generatedAt: '2026-07-20T22:03:52.448Z',
      generator: 'fallback',
      objectives: [
        {
          id: 'objective-1',
          title: 'Trouver une alternance',
          theme: 'ALTERNANCE',
          actions: [
            {
              id: 'p-1',
              label: 'Je fais une action',
              kind: 'advice'
            }
          ]
        }
      ],
      ...args
    }
  }

  beforeEach(() => {
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    planActionService = stubClass(PlanAction.Service)
    evenementService = stubClass(EvenementService)
    handler = new GenererPlanActionCommandHandler(
      jeuneAuthorizer,
      jeuneInviteAuthorizer,
      planActionService,
      evenementService,
      testConfig()
    )
  })

  describe('authorize', () => {
    it("refuse aussi bien un invité qu'un bénéficiaire accompagné quand le mode app jeune est désactivé", async () => {
      // Given
      const handlerDesactive = new GenererPlanActionCommandHandler(
        jeuneAuthorizer,
        jeuneInviteAuthorizer,
        planActionService,
        evenementService,
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const resultInvite = await handlerDesactive.authorize(
        command,
        utilisateur
      )
      const resultAccompagne = await handlerDesactive.authorize(
        command,
        unUtilisateurJeune()
      )

      // Then
      expect(resultInvite).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(resultAccompagne).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
      expect(jeuneInviteAuthorizer.autoriserLInvite).not.to.have.been.called()
    })

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
    it('appelle le service avec le profil traduit et renvoie le plan traduit', async () => {
      // Given
      planActionService.genererPlan.resolves(unPlan())

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionService.genererPlan).to.have.been.calledWithMatch({
        authProvider: 'guest',
        situation: 'LYCEE',
        goals: ['ALTERNANCE']
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
              theme: 'ALTERNANCE',
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
    it("n'appelle pas le service quand l'invité n'est pas autorisé", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const result = await handler.execute(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(planActionService.genererPlan).not.to.have.been.called()
    })
  })

  describe('execute — labels de handler_executed', () => {
    let logInfo: sinon.SinonStub

    beforeEach(() => {
      logInfo = sinon.stub(rootLogger, 'info')
      jeuneInviteAuthorizer.autoriserLInvite.resolves(emptySuccess())
    })

    afterEach(() => {
      logInfo.restore()
    })

    it('trace le générateur et les choix du jeune, un plan de secours étant un succès', async () => {
      // Given
      planActionService.genererPlan.resolves(unPlan({ objectives: [] }))

      // When
      await handler.execute(command, utilisateur)

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'GenererPlanActionCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
          plan_action_generateur: 'fallback',
          plan_action_situation: SituationPayload.LYCEE,
          plan_action_goals: [GoalPayload.ALTERNANCE]
        }
      })
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal([
        Profil.Jeune.MILO,
        Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
        Profil.Jeune.CONSEIL_DEPT,
        Profil.Jeune.INVITE
      ])
    })
  })
})

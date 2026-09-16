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
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { PlanAction } from '../../../src/domain/plan-action'
import {
  GoalPayload,
  SituationPayload
} from '../../../src/infrastructure/routes/validation/plan-action.inputs'
import { rootLogger } from '../../../src/utils/logger.module'
import { TOUT_CONSEIL_DEPARTEMENTAL, Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, sinon, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'
import { unProfilInvite, unProfilMilo } from '../../fixtures/profil.fixture'

describe('GenererPlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let planActionService: StubbedClass<PlanAction.Service>
  let evenementService: StubbedClass<EvenementService>
  let handler: GenererPlanActionCommandHandler

  const utilisateur = unUtilisateurJeune({
    profil: unProfilInvite()
  })
  const command = {
    idJeune: utilisateur.id,
    payload: {
      situation: SituationPayload.LYCEE,
      goals: [GoalPayload.ALTERNANCE]
    }
  }

  function unPlan(): PlanAction.Plan {
    return {
      id: 'plan-1',
      objectifs: [
        {
          id: 'objective-1',
          titre: 'Trouver une alternance',
          theme: 'ALTERNANCE',
          solutions: [
            {
              id: 'p-1',
              category: 'ALTERNANCE',
              blocker: null,
              situations: [],
              auth: [],
              minAge: null,
              maxAge: null,
              territory: null,
              kind: 'advice',
              label: 'Je fais une action',
              url: null,
              serviceName: null
            }
          ]
        }
      ]
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
      const jeuneMilo = unUtilisateurJeune({
        profil: unProfilMilo()
      })
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
      planActionService.genererPlan.returns(unPlan())

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionService.genererPlan).to.have.been.calledWithExactly({
        authProvider: 'guest',
        situation: 'LYCEE',
        goals: ['ALTERNANCE'],
        obstacles: []
      })
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
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
      planActionService.genererPlan.returns(unPlan())
    })

    afterEach(() => {
      logInfo.restore()
    })

    it('trace les choix du jeune', async () => {
      // When
      await handler.execute(command, utilisateur)

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'GenererPlanActionCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
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
        { structure: Profil.Structure.MILO },
        {
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositifs: [
            Profil.Dispositif.CEJ,
            Profil.Dispositif.BRSA,
            Profil.Dispositif.AIJ,
            Profil.Dispositif.AVENIR_PRO,
            Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
            Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
            Profil.Dispositif.EQUIP_EMPLOI_RECRUT
          ]
        },
        TOUT_CONSEIL_DEPARTEMENTAL,
        { structure: Profil.Structure.INVITE }
      ])
    })
  })
})

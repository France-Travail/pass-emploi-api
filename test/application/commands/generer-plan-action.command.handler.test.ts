import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import {
  GenererPlanActionCommand,
  GenererPlanActionCommandHandler
} from '../../../src/application/commands/generer-plan-action.command.handler'
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
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { Questionnaire } from '../../../src/domain/plan-action/questionnaire'
import { ReferentielPlanAction } from '../../../src/domain/plan-action/referentiel-plan-action'
import { rootLogger } from '../../../src/utils/logger.module'
import { TOUT_PROFIL, Profil } from '../../../src/domain/profil'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import {
  StubbedClass,
  createSandbox,
  expect,
  sinon,
  stubClass
} from '../../utils'
import { testConfig } from '../../utils/module-for-testing'
import { unProfilInvite, unProfilMilo } from '../../fixtures/profil.fixture'

describe('GenererPlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let referentielRepository: StubbedType<ReferentielPlanAction.Repository>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let planActionFactory: StubbedClass<PlanAction.Factory>
  let evenementService: StubbedClass<EvenementService>
  let handler: GenererPlanActionCommandHandler

  const maintenant = uneDatetime()

  const utilisateur = unUtilisateurJeune({
    profil: unProfilInvite()
  })
  let command: GenererPlanActionCommand

  function unPlan(): PlanAction {
    return {
      id: 'plan-1',
      idJeune: command.idJeune,
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'objectif-1',
          titre: 'Trouver une alternance',
          theme: Questionnaire.Besoin.ALTERNANCE,
          taches: [
            {
              id: 'tache-1',
              idSolution: 'p-1',
              terminee: false,
              dateCreation: maintenant
            }
          ]
        }
      ]
    }
  }

  function uneSolution(): ReferentielPlanAction.Solution {
    return {
      id: 'p-1',
      besoin: Questionnaire.Besoin.ALTERNANCE,
      type: ReferentielPlanAction.TypeSolution.CONSEIL,
      libelle: 'Je fais une action',
      situations: [],
      authentifications: [],
      territoires: []
    }
  }

  function construireHandler(
    configService: ConfigService
  ): GenererPlanActionCommandHandler {
    return new GenererPlanActionCommandHandler(
      jeuneAuthorizer,
      jeuneInviteAuthorizer,
      referentielRepository,
      planActionRepository,
      planActionFactory,
      evenementService,
      configService
    )
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    referentielRepository = stubInterface(sandbox)
    planActionRepository = stubInterface(sandbox)
    planActionFactory = stubClass(PlanAction.Factory)
    evenementService = stubClass(EvenementService)
    command = {
      idJeune: utilisateur.id,
      situation: Questionnaire.Situation.LYCEE,
      besoins: [Questionnaire.Besoin.ALTERNANCE],
      contraintes: []
    }

    referentielRepository.trouverSolutionsActives.resolves([uneSolution()])
    planActionFactory.creer.returns(unPlan())

    handler = construireHandler(testConfig())
  })

  describe('authorize', () => {
    it("refuse aussi bien un invité qu'un bénéficiaire accompagné quand le mode app jeune est désactivé", async () => {
      // Given
      const handlerDesactive = construireHandler(
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
    it('construit le plan à partir du questionnaire traduit et du référentiel actif, et renvoie le query model', async () => {
      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionFactory.creer).to.have.been.calledWithExactly(
        command.idJeune,
        {
          structure: Profil.Structure.INVITE,
          situation: Questionnaire.Situation.LYCEE,
          besoins: [Questionnaire.Besoin.ALTERNANCE],
          contraintes: []
        },
        [uneSolution()],
        undefined
      )
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'ALTERNANCE',
              actions: [
                {
                  id: 'tache-1',
                  libelle: 'Je fais une action',
                  type: TypeActionPlan.CONSEIL,
                  terminee: false,
                  declarationRequise: false
                }
              ]
            }
          ]
        })
      )
    })

    it('réduit les contraintes à RIEN_NE_ME_BLOQUE quand il est coché avec une autre', async () => {
      // When
      await handler.handle(
        {
          ...command,
          contraintes: [
            Questionnaire.Contrainte.SANTE,
            Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE
          ]
        },
        utilisateur
      )

      // Then
      expect(
        planActionFactory.creer.firstCall.args[1].contraintes
      ).to.deep.equal([Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE])
    })

    it('sauvegarde le plan pour un bénéficiaire accompagné', async () => {
      // Given
      const jeuneMilo = unUtilisateurJeune({ profil: unProfilMilo() })

      // When
      await handler.handle(command, jeuneMilo)

      // Then
      expect(planActionRepository.save).to.have.been.calledWithExactly(unPlan())
    })

    it("construit le plan d'un bénéficiaire accompagné à partir de son dernier plan", async () => {
      // Given
      const jeuneMilo = unUtilisateurJeune({ profil: unProfilMilo() })
      const planPrecedent = { ...unPlan(), id: 'plan-precedent' }
      planActionRepository.getDernierPlan
        .withArgs(command.idJeune)
        .resolves(planPrecedent)

      // When
      await handler.handle(command, jeuneMilo)

      // Then
      expect(planActionFactory.creer.firstCall.args[3]).to.deep.equal(
        planPrecedent
      )
    })

    it("ne sauvegarde pas le plan d'un invité mais le renvoie tout de même", async () => {
      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionRepository.getDernierPlan).not.to.have.been.called()
      expect(planActionRepository.save).not.to.have.been.called()
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'ALTERNANCE',
              actions: [
                {
                  id: 'tache-1',
                  libelle: 'Je fais une action',
                  type: TypeActionPlan.CONSEIL,
                  terminee: false,
                  declarationRequise: false
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
    it("ne construit pas de plan quand l'invité n'est pas autorisé", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const result = await handler.execute(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(planActionFactory.creer).not.to.have.been.called()
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

    it('trace les choix du jeune', async () => {
      // When
      await handler.execute(
        {
          ...command,
          contraintes: [Questionnaire.Contrainte.SANTE],
          domaineProfessionnelVise: 'informatique'
        },
        utilisateur
      )

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'GenererPlanActionCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
          plan_action_situation: Questionnaire.Situation.LYCEE,
          plan_action_goals: [Questionnaire.Besoin.ALTERNANCE],
          plan_action_obstacles: [Questionnaire.Contrainte.SANTE],
          plan_action_domain: 'informatique'
        }
      })
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.equal(TOUT_PROFIL)
    })
  })
})

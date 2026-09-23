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
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import {
  DroitsInsuffisants,
  ErreurHttp
} from '../../../src/building-blocks/types/domain-error'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../src/domain/plan-action/referentiel-plan-action'
import {
  GoalPayload,
  ObstaclePayload,
  SituationPayload
} from '../../../src/infrastructure/routes/validation/plan-action.inputs'
import { rootLogger } from '../../../src/utils/logger.module'
import { TOUT_CONSEIL_DEPARTEMENTAL, Profil } from '../../../src/domain/profil'
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
  let generateur: StubbedType<PlanAction.Generateur>
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

  function uneSuggestion(): PlanAction.Suggestion {
    return {
      accroche: 'Salut !',
      genereLe: maintenant,
      generateur: 'fallback',
      objectifs: [
        {
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          idsSolutions: ['p-1']
        }
      ]
    }
  }

  function unPlan(): PlanAction {
    return {
      id: 'plan-1',
      idJeune: command.idJeune,
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'objectif-1',
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
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
      type: PlanAction.TypeTache.CONSEIL,
      libelle: 'Je fais une action',
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    generateur = stubInterface(sandbox)
    referentielRepository = stubInterface(sandbox)
    planActionRepository = stubInterface(sandbox)
    planActionFactory = stubClass(PlanAction.Factory)
    evenementService = stubClass(EvenementService)
    command = {
      idJeune: utilisateur.id,
      payload: {
        situation: SituationPayload.LYCEE,
        goals: [GoalPayload.ALTERNANCE]
      }
    }

    handler = new GenererPlanActionCommandHandler(
      jeuneAuthorizer,
      jeuneInviteAuthorizer,
      generateur,
      referentielRepository,
      planActionRepository,
      planActionFactory,
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
        generateur,
        referentielRepository,
        planActionRepository,
        planActionFactory,
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
    it('enchaîne la génération, le référentiel et la factory, et renvoie le query model', async () => {
      // Given
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions
        .withArgs(['p-1'])
        .resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          accroche: 'Salut !',
          genereLe: maintenant.toISO(),
          generateur: 'fallback',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'apprenticeship',
              actions: [
                {
                  id: 'tache-1',
                  libelle: 'Je fais une action',
                  type: TypeActionPlan.CONSEIL
                }
              ]
            }
          ]
        })
      )
    })

    it('un échec du générateur est remonté tel quel, sans appeler le référentiel', async () => {
      // Given
      const echec = failure(
        new ErreurHttp("La génération du plan d'action a échoué", 502)
      )
      generateur.genererPlan.resolves(echec)

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(echec)
      expect(referentielRepository.trouverSolutions).not.to.have.been.called()
    })

    it('un échec de la factory est remonté, sans appeler save', async () => {
      // Given
      const jeuneMilo = unUtilisateurJeune({ profil: unProfilMilo() })
      const echec = failure(
        new ErreurHttp(
          "Aucune solution du plan d'action généré n'est présente dans le référentiel",
          502
        )
      )
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([])
      planActionFactory.creer.returns(echec)

      // When
      const result = await handler.handle(command, jeuneMilo)

      // Then
      expect(result).to.deep.equal(echec)
      expect(planActionRepository.save).not.to.have.been.called()
    })

    it('sauvegarde le plan pour un bénéficiaire accompagné', async () => {
      // Given
      const jeuneMilo = unUtilisateurJeune({ profil: unProfilMilo() })
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      await handler.handle(command, jeuneMilo)

      // Then
      expect(planActionRepository.save).to.have.been.calledWithExactly(unPlan())
    })

    it("ne sauvegarde pas le plan d'un invité mais le renvoie tout de même", async () => {
      // Given
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(planActionRepository.save).not.to.have.been.called()
      expect(result).to.deep.equal(
        success({
          id: 'plan-1',
          accroche: 'Salut !',
          genereLe: maintenant.toISO(),
          generateur: 'fallback',
          objectives: [
            {
              id: 'objectif-1',
              titre: 'Trouver une alternance',
              theme: 'apprenticeship',
              actions: [
                {
                  id: 'tache-1',
                  libelle: 'Je fais une action',
                  type: TypeActionPlan.CONSEIL
                }
              ]
            }
          ]
        })
      )
    })

    it('transmet RIEN_NE_ME_BLOQUE au générateur sans le filtrer', async () => {
      // Given
      const commandeSansObstacle = {
        idJeune: utilisateur.id,
        payload: {
          situation: SituationPayload.LYCEE,
          goals: [GoalPayload.ALTERNANCE],
          obstacles: [ObstaclePayload.RIEN_NE_ME_BLOQUE]
        }
      }
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      const result = await handler.handle(commandeSansObstacle, utilisateur)

      // Then
      expect(generateur.genererPlan).to.have.been.calledWithMatch({
        contraintes: [ObstaclePayload.RIEN_NE_ME_BLOQUE]
      })
      expect(isSuccess(result)).to.equal(true)
    })

    it('transmet AUTRE au générateur sans le filtrer', async () => {
      // Given
      const commandeAvecAutre = {
        idJeune: utilisateur.id,
        payload: {
          situation: SituationPayload.LYCEE,
          goals: [GoalPayload.ALTERNANCE],
          obstacles: [ObstaclePayload.AUTRE]
        }
      }
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      await handler.handle(commandeAvecAutre, utilisateur)

      // Then
      expect(generateur.genererPlan).to.have.been.calledWithMatch({
        contraintes: [ObstaclePayload.AUTRE]
      })
    })

    it('transmet un domaine renseigné au profil passé au générateur', async () => {
      // Given
      const commandeAvecDomaine = {
        idJeune: utilisateur.id,
        payload: {
          situation: SituationPayload.LYCEE,
          goals: [GoalPayload.ALTERNANCE],
          domaine: 'informatique'
        }
      }
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      await handler.handle(commandeAvecDomaine, utilisateur)

      // Then
      const profil = generateur.genererPlan.firstCall.args[0]
      expect(profil.domaine).to.equal('informatique')
    })

    it('omet un domaine vide du profil passé au générateur', async () => {
      // Given
      const commandeAvecDomaineVide = {
        idJeune: utilisateur.id,
        payload: {
          situation: SituationPayload.LYCEE,
          goals: [GoalPayload.ALTERNANCE],
          domaine: ''
        }
      }
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      await handler.handle(commandeAvecDomaineVide, utilisateur)

      // Then
      const profil = generateur.genererPlan.firstCall.args[0]
      expect(profil.domaine).to.equal(undefined)
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
    it("n'appelle pas le générateur quand l'invité n'est pas autorisé", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const result = await handler.execute(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(generateur.genererPlan).not.to.have.been.called()
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

    it('trace le générateur et les choix du jeune, un plan fallback étant un succès HTTP', async () => {
      // Given
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([uneSolution()])
      planActionFactory.creer.returns(success(unPlan()))

      // When
      await handler.execute(command, utilisateur)

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'GenererPlanActionCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
          plan_action_generateur: 'fallback',
          plan_action_situation: SituationPayload.LYCEE,
          plan_action_goals: [GoalPayload.ALTERNANCE],
          plan_action_ids_recus: '1',
          plan_action_ids_inconnus: '0'
        }
      })
    })

    it("trace le nombre d'identifiants de solution inconnus du référentiel", async () => {
      // Given
      generateur.genererPlan.resolves(success(uneSuggestion()))
      referentielRepository.trouverSolutions.resolves([])
      planActionFactory.creer.returns(
        failure(
          new ErreurHttp(
            "Aucune solution du plan d'action généré n'est présente dans le référentiel",
            502
          )
        )
      )

      // When
      await handler.execute(command, utilisateur)

      // Then
      const labels = logInfo.firstCall.args[0].labels
      expect(labels.plan_action_ids_recus).to.equal('1')
      expect(labels.plan_action_ids_inconnus).to.equal('1')
    })

    it('trace les choix du jeune sans générateur quand la génération échoue', async () => {
      // Given
      generateur.genererPlan.resolves(
        failure(new ErreurHttp("La génération du plan d'action a échoué", 502))
      )

      // When
      await handler.execute(command, utilisateur)

      // Then
      const labels = logInfo.firstCall.args[0].labels
      expect(labels).to.deep.equal({
        plan_action_situation: SituationPayload.LYCEE,
        plan_action_goals: [GoalPayload.ALTERNANCE]
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

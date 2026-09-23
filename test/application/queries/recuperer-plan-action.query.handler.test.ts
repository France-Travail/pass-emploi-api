import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { RecupererPlanActionQueryHandler } from '../../../src/application/queries/recuperer-plan-action.query.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { TypeActionPlan } from '../../../src/application/queries/query-models/plan-action.query-model'
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
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../src/domain/plan-action/referentiel-plan-action'
import { TOUT_PROFIL_SAUF_INVITE, Profil } from '../../../src/domain/profil'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('RecupererPlanActionQueryHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let referentielRepository: StubbedType<ReferentielPlanAction.Repository>
  let evenementService: StubbedClass<EvenementService>
  let handler: RecupererPlanActionQueryHandler

  const maintenant = uneDatetime()
  const utilisateur = unUtilisateurJeune()
  const query = { idJeune: utilisateur.id }

  function unPlan(): PlanAction {
    return {
      id: 'plan-1',
      idJeune: query.idJeune,
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
      type: PlanAction.TypeTache.NAVIGATION,
      libelle: "Je vais sur l'appli",
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionRepository = stubInterface(sandbox)
    referentielRepository = stubInterface(sandbox)
    evenementService = stubClass(EvenementService)
    handler = new RecupererPlanActionQueryHandler(
      jeuneAuthorizer,
      planActionRepository,
      referentielRepository,
      evenementService,
      testConfig()
    )
  })

  describe('authorize', () => {
    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new RecupererPlanActionQueryHandler(
        jeuneAuthorizer,
        planActionRepository,
        referentielRepository,
        evenementService,
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const result = await handlerDesactive.authorize(query, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it("délègue à l'autorisation jeune standard", async () => {
      // Given
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(query.idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(query, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    it('compose la lecture du plan et celle du référentiel', async () => {
      // Given
      planActionRepository.getDernierPlan
        .withArgs(query.idJeune)
        .resolves(unPlan())
      referentielRepository.trouverSolutions
        .withArgs(['p-1'])
        .resolves([uneSolution()])

      // When
      const result = await handler.handle(query)

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
                  type: TypeActionPlan.NAVIGATION
                }
              ]
            }
          ]
        })
      )
    })

    it("renvoie une NonTrouveError quand le jeune n'a pas de plan sauvegardé", async () => {
      // Given
      planActionRepository.getDernierPlan
        .withArgs(query.idJeune)
        .resolves(undefined)

      // When
      const result = await handler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('PlanAction', query.idJeune))
      )
      expect(referentielRepository.trouverSolutions).not.to.have.been.called()
    })

    it('renvoie une NonTrouveError quand toutes les solutions du plan ont disparu du référentiel', async () => {
      // Given
      planActionRepository.getDernierPlan
        .withArgs(query.idJeune)
        .resolves(unPlan())
      referentielRepository.trouverSolutions.withArgs(['p-1']).resolves([])

      // When
      const result = await handler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('PlanAction', query.idJeune))
      )
    })

    it("écarte l'objectif dont l'unique solution a disparu du référentiel, en conservant les autres", async () => {
      // Given
      const plan: PlanAction = {
        ...unPlan(),
        objectifs: [
          ...unPlan().objectifs,
          {
            id: 'objectif-2',
            titre: 'Se former',
            theme: 'training',
            taches: [
              {
                id: 'tache-2',
                idSolution: 'inconnue',
                terminee: false,
                dateCreation: maintenant
              }
            ]
          }
        ]
      }
      planActionRepository.getDernierPlan.withArgs(query.idJeune).resolves(plan)
      referentielRepository.trouverSolutions
        .withArgs(['p-1', 'inconnue'])
        .resolves([uneSolution()])

      // When
      const result = await handler.handle(query)

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
                  type: TypeActionPlan.NAVIGATION
                }
              ]
            }
          ]
        })
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
        ...TOUT_PROFIL_SAUF_INVITE
      ])
    })
  })
})

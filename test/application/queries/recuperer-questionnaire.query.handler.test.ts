import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { RecupererQuestionnaireQueryHandler } from '../../../src/application/queries/recuperer-questionnaire.query.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { Questionnaire } from '../../../src/domain/plan-action/questionnaire'
import { TOUT_PROFIL_SAUF_INVITE, Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('RecupererQuestionnaireQueryHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let handler: RecupererQuestionnaireQueryHandler

  const utilisateur = unUtilisateurJeune()
  const query = { idJeune: utilisateur.id }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionRepository = stubInterface(sandbox)
    handler = new RecupererQuestionnaireQueryHandler(
      jeuneAuthorizer,
      planActionRepository,
      testConfig()
    )
  })

  describe('authorize', () => {
    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new RecupererQuestionnaireQueryHandler(
        jeuneAuthorizer,
        planActionRepository,
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const result = await handlerDesactive.authorize(query, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
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
    it('renvoie le questionnaire dans le vocabulaire du contrat mobile', async () => {
      // Given
      planActionRepository.getQuestionnaireDuDernierPlan
        .withArgs(query.idJeune)
        .resolves({
          structure: Profil.Structure.MILO,
          situation: Questionnaire.Situation.LYCEE,
          besoins: [Questionnaire.Besoin.ALTERNANCE],
          contraintes: [Questionnaire.Contrainte.SANTE],
          dateNaissance: DateTime.fromISO('2008-03-15'),
          communeResidence: { codeInsee: '75056', nom: 'Paris' },
          communeRecherche: { codeInsee: '69123', nom: 'Lyon' },
          domaineProfessionnelVise: 'informatique',
          rayonKm: 30
        })

      // When
      const result = await handler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success({
          situation: Questionnaire.Situation.LYCEE,
          goals: [Questionnaire.Besoin.ALTERNANCE],
          obstacles: [Questionnaire.Contrainte.SANTE],
          dateNaissance: '2008-03-15',
          habitation: { codeInsee: '75056', nom: 'Paris' },
          villeRecherche: { codeInsee: '69123', nom: 'Lyon' },
          domaine: 'informatique',
          rayonKm: 30
        })
      )
    })

    it("omet les réponses optionnelles que le jeune n'a pas données", async () => {
      // Given
      planActionRepository.getQuestionnaireDuDernierPlan
        .withArgs(query.idJeune)
        .resolves({
          structure: Profil.Structure.MILO,
          situation: Questionnaire.Situation.EMPLOI,
          besoins: [Questionnaire.Besoin.EMPLOI],
          contraintes: []
        })

      // When
      const result = await handler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success({
          situation: Questionnaire.Situation.EMPLOI,
          goals: [Questionnaire.Besoin.EMPLOI],
          obstacles: []
        })
      )
    })

    it("renvoie une erreur NonTrouve quand le jeune n'a pas de questionnaire", async () => {
      // Given
      planActionRepository.getQuestionnaireDuDernierPlan.resolves(undefined)

      // When
      const result = await handler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Questionnaire', query.idJeune))
      )
    })
  })

  describe('profilsAutorises', () => {
    it("n'autorise pas l'invité", () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal([
        ...TOUT_PROFIL_SAUF_INVITE
      ])
    })
  })
})

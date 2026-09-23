import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { expect, StubbedClass, stubClass } from '../../utils'
import { Suggestion } from '../../../src/domain/offre/recherche/suggestion/suggestion'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { createSandbox } from 'sinon'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import {
  uneSuggestion,
  uneSuggestionPE
} from '../../fixtures/suggestion.fixture'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import { SuggestionPoleEmploiService } from '../../../src/domain/offre/recherche/suggestion/pole-emploi.service'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Profil, TOUT_CONSEIL_DEPARTEMENTAL } from '../../../src/domain/profil'
import { unJeune } from '../../fixtures/jeune.fixture'
import { RafraichirSuggestionsCommandHandler } from 'src/application/commands/rafraichir-suggestions.command.handler'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'

describe('RafraichirSuggestionPoleEmploiCommandHandler', () => {
  let handler: RafraichirSuggestionsCommandHandler
  let jeuneRepository: StubbedType<Jeune.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let suggestionFactory: StubbedClass<Suggestion.Factory>
  let suggestionPoleEmploiService: StubbedClass<SuggestionPoleEmploiService>
  let suggestionPoleEmploiRepository: StubbedType<Suggestion.PoleEmploi.Repository>
  let oidcClient: StubbedClass<OidcClient>
  const jeune = unJeune()

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneRepository = stubInterface(sandbox)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    suggestionFactory = stubClass(Suggestion.Factory)
    suggestionPoleEmploiService = stubClass(SuggestionPoleEmploiService)
    suggestionPoleEmploiRepository = stubInterface(sandbox)
    oidcClient = stubClass(OidcClient)
    handler = new RafraichirSuggestionsCommandHandler(
      jeuneRepository,
      jeuneAuthorizer,
      suggestionFactory,
      suggestionPoleEmploiService,
      suggestionPoleEmploiRepository,
      oidcClient
    )
  })

  describe('authorize', () => {
    it('autorise un jeune', async () => {
      // Given
      const utilisateur = unUtilisateurJeune()

      // When
      await handler.authorize(
        {
          idJeune: 'idJeune',
          accessToken: 'token',
          profil: unProfilFT()
        },
        utilisateur
      )

      // Then
      expect(
        jeuneAuthorizer.autoriserLeJeune
      ).to.have.been.calledOnceWithExactly('idJeune', utilisateur)
    })
  })

  describe('handle', () => {
    beforeEach(() => {
      jeuneRepository.get.resolves(jeune)
      oidcClient.exchangeToken
        .withArgs('token', jeune.structure)
        .resolves('idpToken')
    })

    describe("quand l'utilisateur a une structure MILO", () => {
      it("n'appelle pas Pole Emploi et ne rafraichit rien", async () => {
        // When
        const result = await handler.handle({
          idJeune: 'idJeune',
          accessToken: 'token',
          profil: unProfilMilo()
        })

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(suggestionPoleEmploiRepository.findAll).not.to.have.been.called()
        expect(suggestionPoleEmploiService.rafraichir).not.to.have.been.called()
      })
    })

    describe('quand Pole Emploi est up', () => {
      it('rafraichit les suggestions', async () => {
        // Given
        suggestionPoleEmploiRepository.findAll
          .withArgs('idpToken')
          .resolves(success([uneSuggestionPE()]))

        suggestionFactory.buildListeSuggestionsOffresFromPoleEmploi
          .withArgs([uneSuggestionPE()], 'idJeune', unProfilFT())
          .returns([uneSuggestion()])

        // When
        await handler.handle({
          idJeune: 'idJeune',
          accessToken: 'token',
          profil: unProfilFT()
        })

        // Then
        expect(
          suggestionPoleEmploiService.rafraichir
        ).to.have.been.calledWithExactly([uneSuggestion()], 'idJeune')
      })
    })

    describe('quand Pole Emploi est down', () => {
      it("ne retourne pas l'erreur", async () => {
        // Given
        suggestionPoleEmploiRepository.findAll.resolves(
          failure(new ErreurHttp('Service down', 500))
        )

        // When
        const result = await handler.handle({
          idJeune: 'idJeune',
          accessToken: 'token',
          profil: unProfilFT()
        })

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(suggestionPoleEmploiService.rafraichir).not.to.have.been.called()
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
        TOUT_CONSEIL_DEPARTEMENTAL
      ])
    })
  })
})

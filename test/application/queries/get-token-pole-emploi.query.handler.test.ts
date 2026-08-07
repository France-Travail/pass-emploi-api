import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetTokenPoleEmploiQueryHandler } from '../../../src/application/queries/get-token-pole-emploi.query.handler'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Core } from '../../../src/domain/core'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('GetTokenPoleEmploiQueryHandler', () => {
  let getTokenPoleEmploiQueryHandler: GetTokenPoleEmploiQueryHandler
  let oidcClient: StubbedClass<OidcClient>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  const query = {
    idJeune: 'un-id-jeune',
    accessToken: 'bearer coucou'
  }

  beforeEach(async () => {
    oidcClient = stubClass(OidcClient)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)

    getTokenPoleEmploiQueryHandler = new GetTokenPoleEmploiQueryHandler(
      oidcClient,
      jeuneAuthorizer
    )
  })

  describe('handle', () => {
    const utilisateur = unUtilisateurJeune()
    it('récupère et renvoie le token du bénéficiaire', async () => {
      // Given

      oidcClient.exchangeTokenJeune
        .withArgs(query.accessToken, utilisateur.structure)
        .resolves('idpToken')

      // When
      const result = await getTokenPoleEmploiQueryHandler.handle(
        query,
        utilisateur
      )

      // Then
      expect(result._isSuccess && result.data).to.deep.equal('idpToken')
    })
  })

  describe('authorize', () => {
    it('autorise un bénéficiaire Pôle Emploi', async () => {
      // Given
      const utilisateur = unUtilisateurJeune({
        structure: Core.Structure.POLE_EMPLOI
      })
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(query.idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await getTokenPoleEmploiQueryHandler.authorize(
        query,
        utilisateur
      )

      // Then
      expect(result._isSuccess).to.be.true()
    })

    it("rejette un bénéficiaire AVENIR_PRO sans appeler l'authorizer (résidu hors profils)", async () => {
      // Given
      const utilisateur = unUtilisateurJeune({
        structure: Core.Structure.AVENIR_PRO
      })

      // When
      const result = await getTokenPoleEmploiQueryHandler.authorize(
        query,
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(
        failure(new DroitsInsuffisants('auth_user_not_found'))
      )
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
    })
  })

  describe('profilsAutorises', () => {
    it('exige un profil France Travail (le filtrage AVENIR_PRO reste sur estFranceTravail dans authorize)', () => {
      // Then
      expect(getTokenPoleEmploiQueryHandler.profilsAutorises).to.deep.equal([
        Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
        Profil.Jeune.FT_DEMANDEUR_EMPLOI
      ])
    })
  })
})

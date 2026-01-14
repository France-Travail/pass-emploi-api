import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { failure, success } from 'src/building-blocks/types/result'
import { ConseillerAuthorizer } from '../../../../src/application/authorizers/conseiller-authorizer'
import {
  VerifierEmailBeneficiaireFTQuery,
  VerifierEmailBeneficiaireQueryHandler
} from '../../../../src/application/queries/pole-emploi/verifier-email-beneficaire.query.handler'
import { Core, estFranceTravailOuMilo } from '../../../../src/domain/core'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { createSandbox, expect, stubClass } from '../../../utils'
import { DroitsInsuffisants } from '../../../../src/building-blocks/types/domain-error'

describe('VerifierEmailBeneficiaireQueryHandler', () => {
  let verifierEmailBeneficiaireQueryHandler: VerifierEmailBeneficiaireQueryHandler
  const sandbox: SinonSandbox = createSandbox()
  const jeuneRepository: StubbedType<Jeune.Repository> = stubInterface(sandbox)
  const conseillerAuthorizer = stubClass(ConseillerAuthorizer)

  before(async () => {
    verifierEmailBeneficiaireQueryHandler =
      new VerifierEmailBeneficiaireQueryHandler(
        jeuneRepository,
        conseillerAuthorizer
      )
  })

  afterEach(() => {
    sandbox.reset()
  })

  describe('handle', () => {
    it("renvoie emailExistant false si l'email n'existe pas", async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: 'nouveau@test.com'
      }
      jeuneRepository.getByEmail
        .withArgs('nouveau@test.com')
        .resolves(undefined)

      // When
      const result = await verifierEmailBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: false }))
    })

    it("renvoie emailExistant true si l'email existe déjà", async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail
        .withArgs('existant@test.com')
        .resolves(
          unJeune({ structure: Core.Structure.FT_ACCOMPAGNEMENT_GLOBAL })
        )

      // When
      const result = await verifierEmailBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: true }))
    })

    it('ne tient pas compte de la casse et espaces avant la recherche', async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: '  Test@Test.COM  '
      }

      // When
      await verifierEmailBeneficiaireQueryHandler.handle(query)

      // Then
      expect(jeuneRepository.getByEmail).to.have.been.calledWithExactly(
        'test@test.com'
      )
    })

    it('renvoie une erreur pour droits insuffisants si le bénéficiaire du mail est conseiller départemental', async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail
        .withArgs('existant@test.com')
        .resolves(unJeune({ structure: Core.Structure.CONSEIL_DEPT }))

      // When
      const result = await verifierEmailBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })

  describe('authorize', () => {
    it('autorise un conseiller FT et MILO', async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: 'test@test.com'
      }

      const utilisateur = unUtilisateurConseiller({
        structure: Core.Structure.POLE_EMPLOI
      })

      // When
      await verifierEmailBeneficiaireQueryHandler.authorize(query, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserLeConseillerPourTous
      ).to.have.been.calledWithExactly(
        utilisateur,
        estFranceTravailOuMilo(utilisateur.structure)
      )
    })
  })
})

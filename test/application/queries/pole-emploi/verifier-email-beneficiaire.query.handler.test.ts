import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { success } from 'src/building-blocks/types/result'
import { ConseillerAuthorizer } from '../../../../src/application/authorizers/conseiller-authorizer'
import {
  VerifierEmailBeneficiaireFTQuery,
  VerifierEmailBeneficiaireQueryHandler
} from '../../../../src/application/queries/pole-emploi/verifier-email-beneficiaire.query.handler'
import { Core } from '../../../../src/domain/core'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { createSandbox, expect, stubClass } from '../../../utils'

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

    it('retourne un succès si le bénéficiaire du mail est conseiller départemental', async () => {
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
      expect(result).to.deep.equal(success({ emailExistant: true }))
    })
  })

  describe('authorize', () => {
    it('autorise un conseiller dont le bénéficiaire est FT connect', async () => {
      // Given
      const query: VerifierEmailBeneficiaireFTQuery = {
        email: 'test@test.com'
      }

      const utilisateur = unUtilisateurConseiller({
        structure: Core.Structure.CONSEIL_DEPT
      })

      // When
      await verifierEmailBeneficiaireQueryHandler.authorize(query, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserLeConseillerPourTous
      ).to.have.been.calledWithExactly(utilisateur, true)
    })
  })
})

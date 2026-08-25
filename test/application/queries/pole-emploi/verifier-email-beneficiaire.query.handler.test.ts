import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import {
  emptySuccess,
  failure,
  success
} from 'src/building-blocks/types/result'
import { DroitsInsuffisants } from 'src/building-blocks/types/domain-error'
import {
  VerifierEmailBeneficiaireFTQuery,
  VerifierEmailBeneficiaireQueryHandler
} from '../../../../src/application/queries/pole-emploi/verifier-email-beneficiaire.query.handler'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { unJeune } from '../../../fixtures/jeune.fixture'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../../../fixtures/authentification.fixture'
import { createSandbox, expect } from '../../../utils'
import { Profil } from '../../../../src/domain/profil'
import { unProfilFT } from '../../../fixtures/profil.fixture'

describe('VerifierEmailBeneficiaireQueryHandler', () => {
  let verifierEmailBeneficiaireQueryHandler: VerifierEmailBeneficiaireQueryHandler
  const sandbox: SinonSandbox = createSandbox()
  const jeuneRepository: StubbedType<Jeune.Repository> = stubInterface(sandbox)

  before(async () => {
    verifierEmailBeneficiaireQueryHandler =
      new VerifierEmailBeneficiaireQueryHandler(jeuneRepository)
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
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
        })
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
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
          dispositif: null
        })
      )

      // When
      const result = await verifierEmailBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: true }))
    })
  })

  describe('authorize', () => {
    it('autorise un conseiller : le profil FT est garanti par profilsAutorises', async () => {
      // When
      const result = await verifierEmailBeneficiaireQueryHandler.authorize(
        { email: 'test@test.fr' },
        unUtilisateurConseiller()
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('refuse un jeune : le type ne relève pas du profil', async () => {
      // When
      const result = await verifierEmailBeneficiaireQueryHandler.authorize(
        { email: 'test@test.fr' },
        unUtilisateurJeune({ profil: unProfilFT() })
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import {
  emptySuccess,
  failure,
  success
} from 'src/building-blocks/types/result'
import { DroitsInsuffisants } from 'src/building-blocks/types/domain-error'
import {
  VerifierAccompagnementBeneficiaireQuery,
  VerifierAccompagnementBeneficiaireQueryHandler
} from '../../../src/application/queries/verifier-accompagnement-beneficiaire.query.handler'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { unJeune } from '../../fixtures/jeune.fixture'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../../fixtures/authentification.fixture'
import { createSandbox, expect } from '../../utils'
import { Profil, verifierProfils } from '../../../src/domain/profil'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'

describe('VerifierAccompagnementBeneficiaireQueryHandler', () => {
  let verifierAccompagnementBeneficiaireQueryHandler: VerifierAccompagnementBeneficiaireQueryHandler
  const sandbox: SinonSandbox = createSandbox()
  const jeuneRepository: StubbedType<Jeune.Repository> = stubInterface(sandbox)

  before(async () => {
    verifierAccompagnementBeneficiaireQueryHandler =
      new VerifierAccompagnementBeneficiaireQueryHandler(jeuneRepository)
  })

  afterEach(() => {
    sandbox.reset()
  })

  describe('handle', () => {
    it("renvoie dejaAccompagne false si aucun bénéficiaire n'a cet email", async () => {
      // Given
      const query: VerifierAccompagnementBeneficiaireQuery = {
        email: 'nouveau@test.com'
      }
      jeuneRepository.getByEmail
        .withArgs('nouveau@test.com')
        .resolves(undefined)

      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ dejaAccompagne: false }))
    })

    it('renvoie dejaAccompagne true si le bénéficiaire est dans un dispositif accompagné', async () => {
      // Given
      const query: VerifierAccompagnementBeneficiaireQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
        })
      )

      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ dejaAccompagne: true }))
    })

    for (const dispositif of [
      Profil.Dispositif.DEMANDEUR_D_EMPLOI,
      Profil.Dispositif.ESPACE_CANDIDAT
    ]) {
      it(`renvoie dejaAccompagne false si le bénéficiaire est non accompagné (${dispositif}) et sans conseiller : il peut être repris en accompagnement`, async () => {
        // Given
        const query: VerifierAccompagnementBeneficiaireQuery = {
          email: 'existant@test.com'
        }
        jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
          unJeune({
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif,
            conseiller: undefined
          })
        )

        // When
        const result =
          await verifierAccompagnementBeneficiaireQueryHandler.handle(query)

        // Then
        expect(result).to.deep.equal(success({ dejaAccompagne: false }))
        expect(jeuneRepository.getByEmail).to.have.been.calledWithExactly(
          'existant@test.com',
          { includeConseiller: true }
        )
      })
    }

    it('renvoie dejaAccompagne true si le bénéficiaire est non accompagné mais déjà rattaché à un conseiller', async () => {
      // Given
      const query: VerifierAccompagnementBeneficiaireQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.DEMANDEUR_D_EMPLOI
        })
      )

      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ dejaAccompagne: true }))
    })

    it('renvoie dejaAccompagne true si le bénéficiaire est suivi par le conseil départemental', async () => {
      // Given
      const query: VerifierAccompagnementBeneficiaireQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
          dispositif: null
        })
      )

      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ dejaAccompagne: true }))
    })
  })

  describe('profilsAutorises', () => {
    it('autorise les profils France Travail et Conseil départemental', () => {
      // Then
      expect(
        verifierAccompagnementBeneficiaireQueryHandler.profilsAutorises
      ).to.deep.equal([
        { structure: Profil.Structure.FRANCE_TRAVAIL },
        { structure: Profil.Structure.CONSEIL_DEPARTEMENTAL }
      ])
    })

    it('refuse un conseiller MILO', () => {
      // When
      const result = verifierProfils(
        verifierAccompagnementBeneficiaireQueryHandler.profilsAutorises,
        unUtilisateurConseiller({ profil: unProfilMilo() })
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })

  describe('authorize', () => {
    it('autorise un conseiller', async () => {
      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.authorize(
          { email: 'test@test.fr' },
          unUtilisateurConseiller()
        )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('refuse un jeune : le type ne relève pas du profil', async () => {
      // When
      const result =
        await verifierAccompagnementBeneficiaireQueryHandler.authorize(
          { email: 'test@test.fr' },
          unUtilisateurJeune({ profil: unProfilFT() })
        )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})

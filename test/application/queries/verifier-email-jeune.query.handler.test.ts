import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import {
  emptySuccess,
  failure,
  success
} from 'src/building-blocks/types/result'
import { DroitsInsuffisants } from 'src/building-blocks/types/domain-error'
import {
  VerifierEmailJeuneQuery,
  VerifierEmailJeuneQueryHandler
} from '../../../src/application/queries/verifier-email-jeune.query.handler'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { unJeune } from '../../fixtures/jeune.fixture'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../../fixtures/authentification.fixture'
import { createSandbox, expect } from '../../utils'
import { Profil, verifierProfils } from '../../../src/domain/profil'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'

describe('VerifierEmailJeuneQueryHandler', () => {
  let verifierEmailJeuneQueryHandler: VerifierEmailJeuneQueryHandler
  const sandbox: SinonSandbox = createSandbox()
  const jeuneRepository: StubbedType<Jeune.Repository> = stubInterface(sandbox)

  before(async () => {
    verifierEmailJeuneQueryHandler = new VerifierEmailJeuneQueryHandler(
      jeuneRepository
    )
  })

  afterEach(() => {
    sandbox.reset()
  })

  describe('handle', () => {
    it("renvoie emailExistant false si l'email n'existe pas", async () => {
      // Given
      const query: VerifierEmailJeuneQuery = {
        email: 'nouveau@test.com'
      }
      jeuneRepository.getByEmail
        .withArgs('nouveau@test.com')
        .resolves(undefined)

      // When
      const result = await verifierEmailJeuneQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: false }))
    })

    it("renvoie emailExistant true si l'email existe déjà", async () => {
      // Given
      const query: VerifierEmailJeuneQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
        })
      )

      // When
      const result = await verifierEmailJeuneQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: true }))
    })

    for (const dispositif of [
      Profil.Dispositif.DEMANDEUR_D_EMPLOI,
      Profil.Dispositif.ESPACE_CANDIDAT
    ]) {
      it(`renvoie emailExistant false si le jeune est non accompagné (${dispositif}) : il peut être repris en accompagnement`, async () => {
        // Given
        const query: VerifierEmailJeuneQuery = {
          email: 'existant@test.com'
        }
        jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
          unJeune({
            structure: Profil.Structure.FRANCE_TRAVAIL,
            dispositif
          })
        )

        // When
        const result = await verifierEmailJeuneQueryHandler.handle(query)

        // Then
        expect(result).to.deep.equal(success({ emailExistant: false }))
      })
    }

    it('retourne un succès si le bénéficiaire du mail est conseiller départemental', async () => {
      // Given
      const query: VerifierEmailJeuneQuery = {
        email: 'existant@test.com'
      }
      jeuneRepository.getByEmail.withArgs('existant@test.com').resolves(
        unJeune({
          structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
          dispositif: null
        })
      )

      // When
      const result = await verifierEmailJeuneQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(success({ emailExistant: true }))
    })
  })

  describe('profilsAutorises', () => {
    it('autorise les profils France Travail et Conseil départemental', () => {
      // Then
      expect(verifierEmailJeuneQueryHandler.profilsAutorises).to.deep.equal([
        { structure: Profil.Structure.FRANCE_TRAVAIL },
        { structure: Profil.Structure.CONSEIL_DEPARTEMENTAL }
      ])
    })

    it('refuse un conseiller MILO', () => {
      // When
      const result = verifierProfils(
        verifierEmailJeuneQueryHandler.profilsAutorises,
        unUtilisateurConseiller({ profil: unProfilMilo() })
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })

  describe('authorize', () => {
    it('autorise un conseiller', async () => {
      // When
      const result = await verifierEmailJeuneQueryHandler.authorize(
        { email: 'test@test.fr' },
        unUtilisateurConseiller()
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('refuse un jeune : le type ne relève pas du profil', async () => {
      // When
      const result = await verifierEmailJeuneQueryHandler.authorize(
        { email: 'test@test.fr' },
        unUtilisateurJeune({ profil: unProfilFT() })
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})

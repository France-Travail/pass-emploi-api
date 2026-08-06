import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { emptySuccess, failure } from 'src/building-blocks/types/result'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { createSandbox, expect } from '../../utils'

describe('JeuneAuthorizer', () => {
  let jeuneRepository: StubbedType<Jeune.Repository>
  let jeuneAuthorizer: JeuneAuthorizer

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneRepository = stubInterface(sandbox)
    jeuneAuthorizer = new JeuneAuthorizer(jeuneRepository)
  })

  // Le type (JEUNE) et l'exclusion de l'invité sont désormais garantis par
  // `profilsAutorises` avant que cet authorizer ne s'exécute : il ne teste
  // plus que l'appartenance de la ressource.
  describe('autoriserLeJeune', () => {
    describe('quand le jeune idoine est connecté', () => {
      it('retourne un success', async () => {
        // Given
        const utilisateur = unUtilisateurJeune({ id: 'jeune-id' })

        jeuneRepository.existe.withArgs('jeune-id').resolves(true)

        // When
        const result = await jeuneAuthorizer.autoriserLeJeune(
          'jeune-id',
          utilisateur
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
      })
    })
    describe("quand le jeune n'est pas celui connecté", () => {
      it('retourne une failure', async () => {
        // Given
        const utilisateur = unUtilisateurJeune({ id: 'autre-jeune-id' })

        jeuneRepository.existe.withArgs('jeune-id').resolves(true)

        // When
        const result = await jeuneAuthorizer.autoriserLeJeune(
          'jeune-id',
          utilisateur
        )

        // Then
        expect(result).to.deep.equal(
          failure(new DroitsInsuffisants('auth_user_not_found'))
        )
      })
    })

    describe("quand le jeune n'existe pas", () => {
      it('retourne une failure', async () => {
        // Given
        const utilisateur = unUtilisateurJeune({ id: 'jeune-id' })

        jeuneRepository.existe.withArgs('jeune-id').resolves(false)

        // When
        const result = await jeuneAuthorizer.autoriserLeJeune(
          'jeune-id',
          utilisateur
        )

        // Then
        expect(result).to.deep.equal(
          failure(new DroitsInsuffisants('auth_user_not_found'))
        )
      })
    })
  })
})

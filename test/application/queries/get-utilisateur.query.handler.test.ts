import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { Authentification } from 'src/domain/authentification'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from 'test/fixtures/authentification.fixture'
import {
  GetUtilisateurQuery,
  GetUtilisateurQueryHandler
} from '../../../src/application/queries/get-utilisateur.query.handler'
import { failure, success } from '../../../src/building-blocks/types/result'
import { createSandbox, expect } from '../../utils'
import { queryModelFromUtilisateur } from '../../../src/application/queries/query-models/authentification.query-model'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { Profil, profilExact } from '../../../src/domain/profil'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'

describe('GetUtilisateurQueryHandler', () => {
  let authentificationRepository: StubbedType<Authentification.Repository>
  let getUtilisateurQueryHandler: GetUtilisateurQueryHandler
  let sandbox: SinonSandbox

  before(() => {
    sandbox = createSandbox()
    authentificationRepository = stubInterface(sandbox)

    getUtilisateurQueryHandler = new GetUtilisateurQueryHandler(
      authentificationRepository
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it('retourne le jeune utilisateur', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.JEUNE,
        profil: unProfilMilo()
      }
      authentificationRepository.getJeuneByStructureEtDispositifs
        .withArgs(query.idAuthentification, profilExact(query.profil))
        .returns(unUtilisateurJeune())

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success(queryModelFromUtilisateur(unUtilisateurJeune()))
      )
    })
    it('retourne le conseiller utilisateur', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.CONSEILLER,
        profil: unProfilMilo()
      }
      authentificationRepository.getConseiller
        .withArgs(query.idAuthentification)
        .returns(unUtilisateurConseiller())

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success(queryModelFromUtilisateur(unUtilisateurConseiller()))
      )
    })
    it('retourne undefined quand conseiller avec mauvaise structure', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.CONSEILLER,
        profil: unProfilFT()
      }
      authentificationRepository.getConseiller
        .withArgs(query.idAuthentification)
        .returns(unUtilisateurConseiller())

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Utilisateur', query.idAuthentification))
      )
    })
    it('retourne non trouvé', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.JEUNE,
        profil: unProfilFT(Profil.Dispositif.BRSA)
      }
      authentificationRepository.getJeuneByStructureEtDispositifs
        .withArgs(query.idAuthentification, profilExact(query.profil))
        .returns(undefined)

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Utilisateur', query.idAuthentification))
      )
    })
  })
})

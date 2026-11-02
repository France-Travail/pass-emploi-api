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
import {
  failure,
  isFailure,
  success
} from '../../../src/building-blocks/types/result'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { queryModelFromUtilisateur } from '../../../src/application/queries/query-models/authentification.query-model'
import {
  NonTraitableError,
  NonTraitableReason,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import { Migration } from '../../../src/domain/migration'
import { Profil } from '../../../src/domain/profil'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'

describe('GetUtilisateurQueryHandler', () => {
  let authentificationRepository: StubbedType<Authentification.Repository>
  let migrationService: StubbedClass<Migration.Service>
  let getUtilisateurQueryHandler: GetUtilisateurQueryHandler
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = createSandbox()
    authentificationRepository = stubInterface(sandbox)
    migrationService = stubClass(Migration.Service)

    getUtilisateurQueryHandler = new GetUtilisateurQueryHandler(
      authentificationRepository,
      migrationService
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
        .withArgs(query.idAuthentification, {
          structure: query.profil.structure
        })
        .returns(unUtilisateurJeune())

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success(queryModelFromUtilisateur(unUtilisateurJeune()))
      )
    })
    it('retourne le jeune France Travail quel que soit le dispositif demandé', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.JEUNE,
        profil: unProfilFT(Profil.Dispositif.CEJ)
      }
      const jeuneBRSA = unUtilisateurJeune({
        profil: unProfilFT(Profil.Dispositif.BRSA)
      })
      authentificationRepository.getJeuneByStructureEtDispositifs
        .withArgs(query.idAuthentification, {
          structure: Profil.Structure.FRANCE_TRAVAIL
        })
        .returns(jeuneBRSA)

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success(queryModelFromUtilisateur(jeuneBRSA))
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
    it('retourne le conseiller France Travail quel que soit le dispositif demandé', async () => {
      // Given
      const query: GetUtilisateurQuery = {
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.CONSEILLER,
        profil: unProfilFT(Profil.Dispositif.CEJ)
      }
      const conseillerBRSA = unUtilisateurConseiller({
        profil: unProfilFT(Profil.Dispositif.BRSA)
      })
      authentificationRepository.getConseiller
        .withArgs(query.idAuthentification)
        .returns(conseillerBRSA)

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        success(queryModelFromUtilisateur(conseillerBRSA))
      )
    })
    it('retourne non trouvé quand conseiller avec mauvaise structure', async () => {
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
        .withArgs(query.idAuthentification, {
          structure: query.profil.structure
        })
        .returns(undefined)

      // When
      const result = await getUtilisateurQueryHandler.handle(query)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Utilisateur', query.idAuthentification))
      )
    })

    describe('jeune concerné par la migration Parcours Emploi (relecture au refresh)', () => {
      const queryPour = (application?: string): GetUtilisateurQuery => ({
        idAuthentification: 'test-sub',
        typeUtilisateur: Authentification.Type.JEUNE,
        profil: unProfilFT(),
        application
      })
      const unJeuneQuiDoitMigrer = (): Authentification.Utilisateur => {
        const jeune = unUtilisateurJeune({ profil: unProfilFT() })
        authentificationRepository.getJeuneByStructureEtDispositifs
          .withArgs('test-sub', { structure: Profil.Structure.FRANCE_TRAVAIL })
          .returns(jeune)
        migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
          .withArgs({ id: jeune.id, type: Authentification.Type.JEUNE })
          .resolves(true)
        return jeune
      }

      it('refuse le jeune migré avec MIGRATION_PARCOURS_EMPLOI pour pass-emploi', async () => {
        // Given
        const jeune = unJeuneQuiDoitMigrer()

        // When
        const result = await getUtilisateurQueryHandler.handle(
          queryPour(Authentification.Application.PASS_EMPLOI)
        )

        // Then
        expect(result).to.deep.equal(
          failure(
            new NonTraitableError(
              'Utilisateur',
              'test-sub',
              NonTraitableReason.MIGRATION_PARCOURS_EMPLOI,
              jeune.email
            )
          )
        )
      })

      it('refuse le jeune migré quand l’application est absente', async () => {
        // Given
        unJeuneQuiDoitMigrer()

        // When
        const result = await getUtilisateurQueryHandler.handle(
          queryPour(undefined)
        )

        // Then
        expect(isFailure(result)).to.be.true()
        if (isFailure(result)) {
          expect((result.error as NonTraitableError).reason).to.equal(
            NonTraitableReason.MIGRATION_PARCOURS_EMPLOI
          )
        }
      })

      it('retourne le jeune 1j1s sans vérifier la migration', async () => {
        // Given
        const jeune = unJeuneQuiDoitMigrer()

        // When
        const result = await getUtilisateurQueryHandler.handle(
          queryPour(Authentification.Application.UN_JEUNE_UNE_SOLUTION)
        )

        // Then
        expect(result).to.deep.equal(success(queryModelFromUtilisateur(jeune)))
        expect(
          migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
        ).not.to.have.been.called()
      })

      it('ne vérifie pas la migration d’un conseiller', async () => {
        // Given
        authentificationRepository.getConseiller
          .withArgs('test-sub')
          .returns(unUtilisateurConseiller())
        migrationService.faitPartieDeLaMigrationEtLaDateEstPassee.resolves(true)

        // When
        const result = await getUtilisateurQueryHandler.handle({
          idAuthentification: 'test-sub',
          typeUtilisateur: Authentification.Type.CONSEILLER,
          profil: unProfilMilo()
        })

        // Then
        expect(result).to.deep.equal(
          success(queryModelFromUtilisateur(unUtilisateurConseiller()))
        )
        expect(
          migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
        ).not.to.have.been.called()
      })
    })
  })
})

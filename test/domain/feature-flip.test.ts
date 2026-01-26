import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { Authentification } from '../../src/domain/authentification'
import {
  BeneficiaireMigration,
  ConseillerMigration,
  FeatureFlip
} from '../../src/domain/feature-flip'
import { expect } from '../utils'
import Type = Authentification.Type
import Tag = FeatureFlip.Tag

describe('FeatureFlip', () => {
  describe('Service', () => {
    let repository: StubbedType<FeatureFlip.Repository>
    let configService: StubbedType<ConfigService>
    let service: FeatureFlip.Service

    const buildService = (dateFromConfig?: string): void => {
      configService.get
        .withArgs('features.dateDeMigration')
        .returns(dateFromConfig)

      service = new FeatureFlip.Service(
        repository,
        configService as unknown as ConfigService
      )
    }

    beforeEach(() => {
      const sandbox = createSandbox()
      repository = stubInterface<FeatureFlip.Repository>(sandbox)
      configService = stubInterface<ConfigService>(sandbox)
    })

    describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer - bénéficiaire', () => {
      it('renvoie la date (minuit Europe/Paris) quand le jeune fait partie de MIGRATION et que la config contient une date', async () => {
        // Given
        const idJeune = 'jeune-1'
        const rawDate = '2024-09-01'

        buildService(rawDate)
        repository.getBeneficiaireSiFeatureActivePourLeConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(new BeneficiaireMigration('jeune-1'))

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idJeune,
            type: Type.JEUNE
          })

        // Then
        expect(result).to.deep.equal(DateTime.fromISO(rawDate).startOf('day'))
      })

      it("ne renvoie rien si le jeune n'est pas dans la feature", async () => {
        // Given
        const idJeune = 'jeune-2'
        buildService('2024-09-01')
        repository.getBeneficiaireSiFeatureActivePourLeConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(undefined)

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idJeune,
            type: Type.JEUNE
          })

        // Then
        expect(result).to.be.undefined()
      })

      it("ne renvoie rien si la date n'est pas configurée", async () => {
        // Given
        const idJeune = 'jeune-3'
        buildService(undefined)
        repository.getBeneficiaireSiFeatureActivePourLeConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(new BeneficiaireMigration('jeune-1'))

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idJeune,
            type: Type.JEUNE
          })

        // Then
        expect(result).to.be.undefined()
      })
    })

    describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer - conseiller', () => {
      it('renvoie la date quand le conseiller fait partie de MIGRATION et que la config contient une date', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        const rawDate = '2025-03-10'

        buildService(rawDate)
        repository.getConseillerSiFeatureActive
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(new ConseillerMigration(idConseiller))

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idConseiller,
            type: Type.CONSEILLER
          })

        // Then
        expect(result).to.deep.equal(DateTime.fromISO(rawDate).startOf('day'))
      })

      it("ne renvoie rien si le conseiller n'est pas dans la feature", async () => {
        // Given
        const idConseiller = 'conseiller-2'
        buildService('2025-03-10')
        repository.getConseillerSiFeatureActive
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(undefined)

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idConseiller,
            type: Type.CONSEILLER
          })

        // Then
        expect(result).to.be.undefined()
      })

      it("ne renvoie rien si la date n'est pas configurée", async () => {
        // Given
        const idConseiller = 'conseiller-3'
        buildService(undefined)
        repository.getConseillerSiFeatureActive
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(new ConseillerMigration(idConseiller))

        // When
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: idConseiller,
            type: Type.CONSEILLER
          })

        // Then
        expect(result).to.be.undefined()
      })
    })

    describe('laFeatureEstActive', () => {
      it('renvoie true quand le conseiller fait partie de la feature', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        const rawDate = '2025-03-10'

        buildService(rawDate)
        repository.getConseillerSiFeatureActive
          .withArgs(FeatureFlip.Tag.DEMARCHES_IA, idConseiller)
          .resolves(new ConseillerMigration(idConseiller))

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idConseiller,
          type: Type.CONSEILLER
        })

        // Then
        expect(result).to.be.true()
      })
      it('renvoie false quand le conseiller ne fait partie de la feature', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        const rawDate = '2025-03-10'

        buildService(rawDate)
        repository.getConseillerSiFeatureActive
          .withArgs(FeatureFlip.Tag.DEMARCHES_IA, idConseiller)
          .resolves(undefined)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idConseiller,
          type: Type.CONSEILLER
        })

        // Then
        expect(result).to.be.false()
      })
      it('renvoie true quand le bénéficiaire fait partie de la feature', async () => {
        // Given
        const idJeune = 'jeune-1'
        const rawDate = '2024-09-01'

        buildService(rawDate)
        repository.getBeneficiaireSiFeatureActivePourLeConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.DEMARCHES_IA, idJeune)
          .resolves(new BeneficiaireMigration('jeune-1'))

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idJeune,
          type: Type.JEUNE
        })

        // Then
        expect(result).to.be.true()
      })
      it('renvoie false quand le bénéficiaire ne fait pas partie de la feature', async () => {
        // Given
        const idJeune = 'jeune-1'
        const rawDate = '2024-09-01'

        buildService(rawDate)
        repository.getBeneficiaireSiFeatureActivePourLeConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.DEMARCHES_IA, idJeune)
          .resolves(undefined)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idJeune,
          type: Type.JEUNE
        })

        // Then
        expect(result).to.be.false()
      })
    })

    describe('recupererIdsDesBeneficiaireAMigrer', () => {
      it('renvoie les ids de tous les bénéficiaires faisant partie de la feature MIGRATION', async () => {
        // Given
        const rawDate = '2024-09-01'
        buildService(rawDate)
        repository.getBeneficiairesDeLaFeatureDuConseillerDeRattachement
          .withArgs(FeatureFlip.Tag.MIGRATION)
          .resolves([
            new BeneficiaireMigration('jeune-1'),
            new BeneficiaireMigration('jeune-2')
          ])

        // When
        const result = await service.recupererIdsDesBeneficiaireAMigrer()

        // Then
        expect(result).to.deep.equal(['jeune-1', 'jeune-2'])
      })
    })
  })
})

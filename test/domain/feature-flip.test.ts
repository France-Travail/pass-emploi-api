import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { FeatureFlip } from '../../src/domain/feature-flip'
import { expect } from '../utils'

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

    describe('recupererDateDeMigrationBeneficiaire', () => {
      it('renvoie la date (minuit Europe/Paris) quand le jeune fait partie de MIGRATION et que la config contient une date', async () => {
        // Given
        const idJeune = 'jeune-1'
        const rawDate = '2024-09-01'

        buildService(rawDate)
        repository.featureActivePourBeneficiaire
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(true)

        // When
        const result = await service.recupererDateDeMigrationBeneficiaire(
          idJeune
        )

        // Then
        expect(result).to.equal('2024-09-01T00:00:00.000+02:00')
      })

      it("ne renvoie rien si le jeune n'est pas dans la feature", async () => {
        // Given
        const idJeune = 'jeune-2'
        buildService('2024-09-01')
        repository.featureActivePourBeneficiaire
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(false)

        // When
        const result = await service.recupererDateDeMigrationBeneficiaire(
          idJeune
        )

        // Then
        expect(result).to.be.undefined()
      })

      it("ne renvoie rien si la date n'est pas configurée", async () => {
        // Given
        const idJeune = 'jeune-3'
        buildService(undefined)
        repository.featureActivePourBeneficiaire
          .withArgs(FeatureFlip.Tag.MIGRATION, idJeune)
          .resolves(true)

        // When
        const result = await service.recupererDateDeMigrationBeneficiaire(
          idJeune
        )

        // Then
        expect(result).to.be.undefined()
      })
    })

    describe('recupererDateDeMigrationConseiller', () => {
      it('renvoie la date (minuit Europe/Paris) quand le conseiller fait partie de MIGRATION et que la config contient une date', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        const rawDate = '2025-03-10'

        buildService(rawDate)
        repository.featureActivePourConseiller
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(true)

        // When
        const result = await service.recupererDateDeMigrationConseiller(
          idConseiller
        )

        // Then
        expect(result).to.equal('2025-03-10T00:00:00.000+01:00')
      })

      it("ne renvoie rien si le conseiller n'est pas dans la feature", async () => {
        // Given
        const idConseiller = 'conseiller-2'
        buildService('2025-03-10')
        repository.featureActivePourConseiller
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(false)

        // When
        const result = await service.recupererDateDeMigrationConseiller(
          idConseiller
        )

        // Then
        expect(result).to.be.undefined()
      })

      it("ne renvoie rien si la date n'est pas configurée", async () => {
        // Given
        const idConseiller = 'conseiller-3'
        buildService(undefined)
        repository.featureActivePourConseiller
          .withArgs(FeatureFlip.Tag.MIGRATION, idConseiller)
          .resolves(true)

        // When
        const result = await service.recupererDateDeMigrationConseiller(
          idConseiller
        )

        // Then
        expect(result).to.be.undefined()
      })
    })
  })
})

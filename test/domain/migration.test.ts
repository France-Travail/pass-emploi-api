import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { Authentification } from '../../src/domain/authentification'
import { FeatureFlip } from '../../src/domain/feature-flip'
import { BeneficiaireMigration, Migration } from '../../src/domain/migration'
import { expect, stubClass } from '../utils'
import { DateService } from '../../src/utils/date-service'
import { uneDate } from '../fixtures/date.fixture'
import Type = Authentification.Type
import PhaseDeMigration = Migration.PhaseDeMigration

describe('Migration', () => {
  describe('Service', () => {
    let migrationRepository: StubbedType<Migration.Repository>
    let featureFlipRepository: StubbedType<FeatureFlip.Repository>
    let configService: StubbedType<ConfigService>
    let service: Migration.Service
    const dateService = stubClass(DateService)
    const maintenant = DateService.fromJSDateToDateTime(uneDate())!
    dateService.nowJs.returns(maintenant.toJSDate())
    dateService.now.returns(maintenant)

    const buildService = (datePhaseA?: string, datePhaseB?: string): void => {
      configService.get
        .withArgs('features.dateDeMigrationPhaseA')
        .returns(datePhaseA)
      configService.get
        .withArgs('features.dateDeMigrationPhaseB')
        .returns(datePhaseB)

      service = new Migration.Service(
        migrationRepository,
        featureFlipRepository,
        configService as unknown as ConfigService,
        dateService
      )
    }

    beforeEach(() => {
      const sandbox = createSandbox()
      migrationRepository = stubInterface<Migration.Repository>(sandbox)
      featureFlipRepository = stubInterface<FeatureFlip.Repository>(sandbox)
      configService = stubInterface<ConfigService>(sandbox)
    })

    describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer - bénéficiaire', () => {
      it('renvoie la date (minuit Europe/Paris) quand le jeune fait partie de MIGRATION et que la config contient une date', async () => {
        // Given
        const idJeune = 'jeune-1'
        const rawDate = '2024-09-01'

        buildService(rawDate)
        featureFlipRepository.getTagSiFeatureActivePourLeConseillerDuJeune
          .withArgs(
            [
              FeatureFlip.Tag.MIGRATION_PHASE_A,
              FeatureFlip.Tag.MIGRATION_PHASE_B,
              FeatureFlip.Tag.MIGRATION_PHASE_TEST
            ],
            idJeune
          )
          .resolves(FeatureFlip.Tag.MIGRATION_PHASE_A)

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
        featureFlipRepository.getTagSiFeatureActivePourLeConseillerDuJeune
          .withArgs(
            [
              FeatureFlip.Tag.MIGRATION_PHASE_A,
              FeatureFlip.Tag.MIGRATION_PHASE_B,
              FeatureFlip.Tag.MIGRATION_PHASE_TEST
            ],
            idJeune
          )
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
        featureFlipRepository.getTagSiFeatureActivePourLeConseillerDuJeune.withArgs(
          [
            FeatureFlip.Tag.MIGRATION_PHASE_A,
            FeatureFlip.Tag.MIGRATION_PHASE_B,
            FeatureFlip.Tag.MIGRATION_PHASE_TEST
          ],
          idJeune
        )

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
        featureFlipRepository.getTagSiFeatureActivePourLeConseiller
          .withArgs(
            [
              FeatureFlip.Tag.MIGRATION_PHASE_A,
              FeatureFlip.Tag.MIGRATION_PHASE_B,
              FeatureFlip.Tag.MIGRATION_PHASE_TEST
            ],
            idConseiller
          )
          .resolves(FeatureFlip.Tag.MIGRATION_PHASE_A)

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
        featureFlipRepository.getTagSiFeatureActivePourLeConseiller
          .withArgs(
            [
              FeatureFlip.Tag.MIGRATION_PHASE_A,
              FeatureFlip.Tag.MIGRATION_PHASE_B,
              FeatureFlip.Tag.MIGRATION_PHASE_TEST
            ],
            idConseiller
          )
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
    })

    describe('recupererIdsDesBeneficiaireAMigrer', () => {
      it('renvoie les ids de tous les bénéficiaires faisant partie de la feature MIGRATION', async () => {
        // Given
        const rawDate = '2024-09-01'
        buildService(rawDate)
        migrationRepository.getBeneficiairesDeLaFeatureDuConseillerInitial
          .withArgs(FeatureFlip.Tag.MIGRATION_PHASE_A)
          .resolves([
            new BeneficiaireMigration('jeune-1'),
            new BeneficiaireMigration('jeune-2')
          ])

        // When
        const result = await service.recupererIdsDesBeneficiaireAMigrer(
          PhaseDeMigration.PHASE_A
        )

        // Then
        expect(result).to.deep.equal(['jeune-1', 'jeune-2'])
      })
    })
  })
})

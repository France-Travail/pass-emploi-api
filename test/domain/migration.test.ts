import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { Authentification } from '../../src/domain/authentification'
import { BeneficiaireMigration, Migration } from '../../src/domain/migration'
import { DateService } from '../../src/utils/date-service'
import { StubbedClass, expect, stubClass } from '../utils'

describe('Migration', () => {
  const maintenant = DateTime.fromISO('2026-09-12T12:00:00.000Z')
  const unJeune: Migration.Utilisateur = {
    id: 'id-jeune',
    type: Authentification.Type.JEUNE
  }
  const unConseiller: Migration.Utilisateur = {
    id: 'id-conseiller',
    type: Authentification.Type.CONSEILLER
  }

  let migrationRepository: StubbedType<Migration.Repository>
  let dateService: StubbedClass<DateService>
  let service: Migration.Service

  beforeEach(() => {
    const sandbox = createSandbox()
    migrationRepository = stubInterface<Migration.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    service = new Migration.Service(migrationRepository, dateService)
  })

  describe('migrationExiste', () => {
    it('dit si la vague existe en base', async () => {
      // Given
      migrationRepository.existe.withArgs('PHASE_A').resolves(true)
      migrationRepository.existe.withArgs('INCONNUE').resolves(false)

      // Then
      expect(await service.migrationExiste('PHASE_A')).to.equal(true)
      expect(await service.migrationExiste('INCONNUE')).to.equal(false)
    })
  })

  describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer', () => {
    it('interroge le conseiller du bénéficiaire pour un jeune', async () => {
      // Given
      const dateDeMigration = DateTime.fromISO('2026-11-20T00:00:00.000Z')
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire
        .withArgs('id-jeune')
        .resolves(dateDeMigration)

      // When
      const date =
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer(unJeune)

      // Then
      expect(date).to.deep.equal(dateDeMigration)
    })

    it('interroge directement le conseiller pour un conseiller', async () => {
      // Given
      const dateDeMigration = DateTime.fromISO('2026-11-20T00:00:00.000Z')
      migrationRepository.getDateDeMigrationDuConseiller
        .withArgs('id-conseiller')
        .resolves(dateDeMigration)

      // When
      const date =
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer(
          unConseiller
        )

      // Then
      expect(date).to.deep.equal(dateDeMigration)
      expect(
        migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire
      ).not.to.have.been.called()
    })

    it("ne renvoie rien quand aucune date n'est posée", async () => {
      // Given
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire.resolves(
        undefined
      )

      // When
      const date =
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer(unJeune)

      // Then
      expect(date).to.equal(undefined)
    })
  })

  describe('faitPartieDeLaMigrationEtLaDateEstPassee', () => {
    it('est vraie quand la date de migration est passée', async () => {
      // Given
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire.resolves(
        maintenant.minus({ days: 1 })
      )

      // When
      const doitMigrer =
        await service.faitPartieDeLaMigrationEtLaDateEstPassee(unJeune)

      // Then
      expect(doitMigrer).to.equal(true)
    })

    it('est vraie le jour même de la migration', async () => {
      // Given
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire.resolves(
        maintenant.startOf('day')
      )

      // When
      const doitMigrer =
        await service.faitPartieDeLaMigrationEtLaDateEstPassee(unJeune)

      // Then
      expect(doitMigrer).to.equal(true)
    })

    it("est fausse quand la date de migration n'est pas atteinte", async () => {
      // Given
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire.resolves(
        maintenant.plus({ days: 1 })
      )

      // When
      const doitMigrer =
        await service.faitPartieDeLaMigrationEtLaDateEstPassee(unJeune)

      // Then
      expect(doitMigrer).to.equal(false)
    })

    it('est fausse sans date, même si le conseiller est dans une vague', async () => {
      // Given
      migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire.resolves(
        undefined
      )

      // When
      const doitMigrer =
        await service.faitPartieDeLaMigrationEtLaDateEstPassee(unJeune)

      // Then
      expect(doitMigrer).to.equal(false)
    })
  })

  describe('recupererIdsDesBeneficiaireAMigrer', () => {
    it('interroge le repository avec la vague demandée', async () => {
      // Given
      migrationRepository.getBeneficiairesDeLaMigrationDuConseillerInitial
        .withArgs('PHASE_A')
        .resolves([new BeneficiaireMigration('id-jeune')])

      // When
      const ids = await service.recupererIdsDesBeneficiaireAMigrer('PHASE_A')

      // Then
      expect(ids).to.deep.equal(['id-jeune'])
    })
  })

  describe('rebasculerOrphelins', () => {
    it('interroge le repository avec la vague demandée', async () => {
      // Given
      const rebasculement = {
        idJeune: 'id-jeune',
        ancienIdConseiller: 'ancien',
        nouveauIdConseiller: 'nouveau'
      }
      migrationRepository.rebasculerOrphelins
        .withArgs('PHASE_B')
        .resolves([rebasculement])

      // When
      const rebasculements = await service.rebasculerOrphelins('PHASE_B')

      // Then
      expect(rebasculements).to.deep.equal([rebasculement])
    })
  })
})

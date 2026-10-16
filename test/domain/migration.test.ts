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

  const uneMigration = (
    dateActivation: DateTime
  ): Migration.MigrationActive => ({
    dateActivation,
    idPopulation: 'POP_PASS_EMPLOI'
  })

  describe('recupererMigrationDeLUtilisateur', () => {
    it('interroge la migration du bénéficiaire pour un jeune', async () => {
      // Given
      const migration = uneMigration(
        DateTime.fromISO('2026-11-20T00:00:00.000Z')
      )
      migrationRepository.getMigrationDuBeneficiaire
        .withArgs('id-jeune')
        .resolves(migration)

      // When
      const resultat = await service.recupererMigrationDeLUtilisateur(unJeune)

      // Then
      expect(resultat).to.deep.equal(migration)
    })

    it('interroge directement le conseiller pour un conseiller', async () => {
      // Given
      const migration = uneMigration(
        DateTime.fromISO('2026-11-20T00:00:00.000Z')
      )
      migrationRepository.getMigrationDuConseiller
        .withArgs('id-conseiller')
        .resolves(migration)

      // When
      const resultat =
        await service.recupererMigrationDeLUtilisateur(unConseiller)

      // Then
      expect(resultat).to.deep.equal(migration)
      expect(
        migrationRepository.getMigrationDuBeneficiaire
      ).not.to.have.been.called()
    })
  })

  describe('populationDeMigrationActive', () => {
    it('renvoie la population quand la date de migration est passée', async () => {
      // Given
      migrationRepository.getMigrationDuBeneficiaire.resolves(
        uneMigration(maintenant.minus({ days: 1 }))
      )

      // When / Then
      expect(await service.populationDeMigrationActive(unJeune)).to.equal(
        'POP_PASS_EMPLOI'
      )
    })

    it('renvoie la population le jour même de la migration', async () => {
      // Given
      migrationRepository.getMigrationDuBeneficiaire.resolves(
        uneMigration(maintenant.startOf('day'))
      )

      // When / Then
      expect(await service.populationDeMigrationActive(unJeune)).to.equal(
        'POP_PASS_EMPLOI'
      )
    })

    it("ne renvoie rien quand la date de migration n'est pas atteinte", async () => {
      // Given
      migrationRepository.getMigrationDuBeneficiaire.resolves(
        uneMigration(maintenant.plus({ days: 1 }))
      )

      // When / Then
      expect(
        await service.populationDeMigrationActive(unJeune)
      ).to.be.undefined()
    })

    it("ne renvoie rien quand l'utilisateur n'est dans aucune migration", async () => {
      // Given
      migrationRepository.getMigrationDuBeneficiaire.resolves(undefined)

      // When / Then
      expect(
        await service.populationDeMigrationActive(unJeune)
      ).to.be.undefined()
    })
  })

  describe('recupererIdsDesBeneficiaireAMigrer', () => {
    it('interroge le repository avec la vague demandée', async () => {
      // Given
      migrationRepository.getBeneficiairesAMigrerParProfilOuConseillerCite
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

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { Authentification } from '../../src/domain/authentification'
import { BeneficiaireMigration, Migration } from '../../src/domain/migration'
import { Population } from '../../src/domain/population'
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

  let populationRepository: StubbedType<Population.Repository>
  let migrationRepository: StubbedType<Migration.Repository>
  let dateService: StubbedClass<DateService>
  let service: Migration.Service

  beforeEach(() => {
    const sandbox = createSandbox()
    populationRepository = stubInterface<Population.Repository>(sandbox)
    migrationRepository = stubInterface<Migration.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    service = new Migration.Service(
      populationRepository,
      migrationRepository,
      dateService
    )
  })

  const uneMigration = (
    dateActivation: DateTime
  ): Migration.MigrationActive => ({
    dateActivation,
    idPopulation: 'POP_PASS_EMPLOI'
  })

  describe('recupererMigrationDeLUtilisateur', () => {
    it('interroge la migration des populations du jeune', async () => {
      // Given
      const migration = uneMigration(
        DateTime.fromISO('2026-11-20T00:00:00.000Z')
      )
      populationRepository.getIdsPopulationsDuJeune
        .withArgs('id-jeune')
        .resolves(['pop1'])
      migrationRepository.getMigration.withArgs(['pop1']).resolves(migration)

      // When
      const resultat = await service.recupererMigrationDeLUtilisateur(unJeune)

      // Then
      expect(resultat).to.deep.equal(migration)
    })

    it('interroge la migration des populations du conseiller', async () => {
      // Given
      const migration = uneMigration(
        DateTime.fromISO('2026-11-20T00:00:00.000Z')
      )
      populationRepository.getIdsPopulationsDuConseiller
        .withArgs('id-conseiller')
        .resolves(['pop1'])
      migrationRepository.getMigration.withArgs(['pop1']).resolves(migration)

      // When
      const resultat =
        await service.recupererMigrationDeLUtilisateur(unConseiller)

      // Then
      expect(resultat).to.deep.equal(migration)
      expect(
        populationRepository.getIdsPopulationsDuJeune
      ).not.to.have.been.called()
    })

    it("ne renvoie rien quand aucune date n'est posée", async () => {
      // Given
      populationRepository.getIdsPopulationsDuJeune.resolves(['pop1'])
      migrationRepository.getMigration.resolves(undefined)

      // When
      const resultat = await service.recupererMigrationDeLUtilisateur(unJeune)

      // Then
      expect(resultat).to.be.undefined()
    })
  })

  describe('populationDeMigrationActive', () => {
    beforeEach(() => {
      populationRepository.getIdsPopulationsDuJeune.resolves(['pop1'])
    })

    it('renvoie la population quand la date de migration est passée', async () => {
      // Given
      migrationRepository.getMigration.resolves(
        uneMigration(maintenant.minus({ days: 1 }))
      )

      // When / Then
      expect(await service.populationDeMigrationActive(unJeune)).to.equal(
        'POP_PASS_EMPLOI'
      )
    })

    it('renvoie la population le jour même de la migration', async () => {
      // Given
      migrationRepository.getMigration.resolves(
        uneMigration(maintenant.startOf('day'))
      )

      // When / Then
      expect(await service.populationDeMigrationActive(unJeune)).to.equal(
        'POP_PASS_EMPLOI'
      )
    })

    it("ne renvoie rien quand la date de migration n'est pas atteinte", async () => {
      // Given
      migrationRepository.getMigration.resolves(
        uneMigration(maintenant.plus({ days: 1 }))
      )

      // When / Then
      expect(
        await service.populationDeMigrationActive(unJeune)
      ).to.be.undefined()
    })

    it("ne renvoie rien quand l'utilisateur n'est dans aucune migration", async () => {
      // Given
      migrationRepository.getMigration.resolves(undefined)

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

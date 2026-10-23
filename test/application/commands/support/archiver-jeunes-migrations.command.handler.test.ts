import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { ArchiverJeunesMigrationCommandHandler } from '../../../../src/application/commands/archiver-jeunes-migrations.command.handler'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { Migration } from '../../../../src/domain/migration'
import { Planificateur } from '../../../../src/domain/planificateur'
import { DateService } from '../../../../src/utils/date-service'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('ArchiverJeunesMigrationCommandHandler', () => {
  let archiverJeunesMigrationCommandHandler: ArchiverJeunesMigrationCommandHandler
  let migrationRepository: StubbedType<Migration.Repository>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>

  const maintenant = new Date('2022-03-01T03:24:00Z')

  beforeEach(() => {
    const sandbox = createSandbox()
    migrationRepository = stubInterface<Migration.Repository>(sandbox)
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)

    archiverJeunesMigrationCommandHandler =
      new ArchiverJeunesMigrationCommandHandler(
        migrationRepository,
        planificateurRepository,
        dateService
      )
  })

  describe('authorize', () => {
    it("autorise : l'accès support est contrôlé par la clé API du controller", async () => {
      // When
      const result = await archiverJeunesMigrationCommandHandler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    it("échoue quand la vague de migration n'existe pas", async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_INCONNUE')
        .resolves(false)

      // When
      const result = await archiverJeunesMigrationCommandHandler.handle({
        idPopulationQuiMigre: 'PHASE_INCONNUE'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Migration', 'PHASE_INCONNUE'))
      )
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it("planifie le job d'archivage de la population", async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_A')
        .resolves(true)

      // When
      const result = await archiverJeunesMigrationCommandHandler.handle({
        idPopulationQuiMigre: 'PHASE_A'
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant,
        type: Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
        contenu: { idPopulation: 'PHASE_A' }
      })
    })
  })
})

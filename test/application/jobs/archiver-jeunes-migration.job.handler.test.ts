import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  ArchiverJeunesMigrationJobHandler,
  TAILLE_LOT_ARCHIVAGE_MIGRATION
} from '../../../src/application/jobs/archiver-jeunes-migration.job.handler'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Migration } from '../../../src/domain/migration'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport

describe('ArchiverJeunesMigrationJobHandler', () => {
  let archiverJeunesMigrationJobHandler: ArchiverJeunesMigrationJobHandler
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let migrationService: StubbedClass<Migration.Service>
  let archiveJeuneService: StubbedClass<ArchiveJeune.Service>
  let dateService: StubbedClass<DateService>

  const maintenant = uneDatetime()

  beforeEach(() => {
    const sandbox = createSandbox()
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    migrationService = stubClass(Migration.Service)
    archiveJeuneService = stubClass(ArchiveJeune.Service)
    archiveJeuneService.archiverEnMasse.callsFake(async ids => ({
      idsJeunesArchives: ids,
      nbEchecsNettoyage: 0
    }))
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())

    archiverJeunesMigrationJobHandler = new ArchiverJeunesMigrationJobHandler(
      stubInterface<SuiviJob.Service>(sandbox),
      dateService,
      planificateurRepository,
      migrationService,
      archiveJeuneService
    )
  })

  function unJob(
    contenu: Planificateur.JobArchiverJeunesMigration
  ): Planificateur.Job<Planificateur.JobArchiverJeunesMigration> {
    return {
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
      contenu
    }
  }

  function desIds(nombre: number): string[] {
    return Array.from(
      { length: nombre },
      (_, index) => `jeune-${String(index).padStart(3, '0')}`
    )
  }

  describe('quand le lot est plein', () => {
    it('archive les 100 premiers ids triés et se replanifie avec apresId', async () => {
      // Given
      const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1)
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves([...ids].reverse())

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(
        archiveJeuneService.archiverEnMasse
      ).to.have.been.calledOnceWithExactly(
        ids.slice(0, TAILLE_LOT_ARCHIVAGE_MIGRATION),
        "Pour des raisons de migration nous avons procédé à l'archivage de votre compte.",
        MotifSuppressionSupport.MIGRATION,
        'PHASE_A'
      )
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant.toJSDate(),
        type: Planificateur.JobType.ARCHIVER_JEUNES_MIGRATION,
        contenu: {
          idPopulation: 'PHASE_A',
          apresId: 'jeune-099'
        }
      })
      expect(suiviJob.succes).to.be.true()
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: TAILLE_LOT_ARCHIVAGE_MIGRATION,
        nbEchecs: 0,
        termine: false
      })
    })
  })

  describe('quand un apresId est fourni', () => {
    it('ne prend que les ids strictement supérieurs', async () => {
      // Given
      const ids = ['jeune-1', 'jeune-2', 'jeune-3']
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(ids)

      // When
      await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A', apresId: 'jeune-1' })
      )

      // Then
      expect(
        archiveJeuneService.archiverEnMasse
      ).to.have.been.calledOnceWithExactly(
        ['jeune-2', 'jeune-3'],
        "Pour des raisons de migration nous avons procédé à l'archivage de votre compte.",
        MotifSuppressionSupport.MIGRATION,
        'PHASE_A'
      )
    })
  })

  describe('quand le lot est le dernier', () => {
    it('ne se replanifie pas et marque le job comme terminé', async () => {
      // Given
      const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION - 10)
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(ids)

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: TAILLE_LOT_ARCHIVAGE_MIGRATION - 10,
        nbEchecs: 0,
        termine: true
      })
    })
  })

  describe("quand l'archivage groupé échoue", () => {
    it('rejoue jeune par jeune et compte seulement les jeunes en erreur dans nbEchecs', async () => {
      // Given
      const ids = desIds(5)
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(ids)
      archiveJeuneService.archiverEnMasse
        .withArgs(ids)
        .rejects(new Error('Donnée invalide'))
      archiveJeuneService.archiverEnMasse
        .withArgs(['jeune-000'])
        .rejects(new Error('Donnée invalide'))
      archiveJeuneService.archiverEnMasse
        .withArgs(['jeune-002'])
        .rejects(new Error('Donnée invalide'))

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(archiveJeuneService.archiverEnMasse).to.have.callCount(1 + 5)
      expect(suiviJob.succes).to.be.false()
      expect(suiviJob.nbErreurs).to.equal(2)
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: 3,
        nbEchecs: 2,
        termine: true
      })
    })
  })

  describe('quand tous les jeunes sont archivés avec succès', () => {
    it('retourne succes true et nbErreurs 0', async () => {
      // Given
      const ids = desIds(10)
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(ids)

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(suiviJob.succes).to.be.true()
      expect(suiviJob.nbErreurs).to.equal(0)
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: 10,
        nbEchecs: 0,
        termine: true
      })
    })
  })
})

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, SinonSandbox } from 'sinon'
import {
  ArchiverJeunesMigrationJobHandler,
  TAILLE_LOT_ARCHIVAGE_MIGRATION
} from '../../../src/application/jobs/archiver-jeunes-migration.job.handler'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Migration } from '../../../src/domain/migration'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { getWorkerTrackingServiceInstance } from '../../../src/infrastructure/monitoring/worker.tracking.service'
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
  let suiviJobService: StubbedType<SuiviJob.Service>
  let sandbox: SinonSandbox

  const maintenant = uneDatetime()

  beforeEach(() => {
    sandbox = createSandbox()
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

    suiviJobService = stubInterface<SuiviJob.Service>(sandbox)

    archiverJeunesMigrationJobHandler = new ArchiverJeunesMigrationJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository,
      migrationService,
      archiveJeuneService
    )
  })

  afterEach(() => {
    sandbox.restore()
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
          apresId: 'jeune-099',
          jobRunId: undefined,
          cumul: {
            nbTraites: TAILLE_LOT_ARCHIVAGE_MIGRATION,
            nbEchecs: 0,
            nbEchecsNettoyage: 0
          }
        }
      })
      expect(suiviJob.succes).to.be.true()
      expect(suiviJob.intermediaire).to.be.true()
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: TAILLE_LOT_ARCHIVAGE_MIGRATION,
        nbEchecs: 0,
        nbEchecsNettoyage: 0,
        termine: false
      })
    })

    it('reprend le job_run_id du premier lot et le transmet au lot suivant', async () => {
      // Given
      const workerTrackingService = getWorkerTrackingServiceInstance()
      const remplacerJobRunId = sandbox.stub(
        workerTrackingService,
        'remplacerJobRunId'
      )
      sandbox
        .stub(workerTrackingService, 'getCurrentJobTracking')
        .returns({ jobRunId: 'job-run-du-premier-lot' })
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1))

      // When
      await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A', jobRunId: 'job-run-du-premier-lot' })
      )

      // Then
      expect(remplacerJobRunId).to.have.been.calledOnceWithExactly(
        'job-run-du-premier-lot'
      )
      expect(
        planificateurRepository.ajouterJob.firstCall.args[0].contenu
      ).to.include({ jobRunId: 'job-run-du-premier-lot' })
    })

    it("n'enregistre pas de suivi de job tant que l'exécution n'est pas terminée", async () => {
      // Given
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1))

      // When
      await archiverJeunesMigrationJobHandler.execute(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(suiviJobService.save).not.to.have.been.called()
      expect(suiviJobService.notifierResultatJob).not.to.have.been.called()
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
      expect(suiviJob.intermediaire).to.be.false()
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: TAILLE_LOT_ARCHIVAGE_MIGRATION - 10,
        nbEchecs: 0,
        nbEchecsNettoyage: 0,
        termine: true
      })
    })

    it("porte le bilan cumulé de toute l'exécution", async () => {
      // Given
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(desIds(10))
      archiveJeuneService.archiverEnMasse.callsFake(async ids => ({
        idsJeunesArchives: ids,
        nbEchecsNettoyage: 1
      }))

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({
          idPopulation: 'PHASE_A',
          cumul: { nbTraites: 98, nbEchecs: 2, nbEchecsNettoyage: 3 }
        })
      )

      // Then
      expect(suiviJob.succes).to.be.false()
      expect(suiviJob.nbErreurs).to.equal(2)
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: 108,
        nbEchecs: 2,
        nbEchecsNettoyage: 4,
        termine: true
      })
    })

    it('enregistre le suivi de job', async () => {
      // Given
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(desIds(10))

      // When
      await archiverJeunesMigrationJobHandler.execute(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(suiviJobService.save).to.have.been.calledOnce()
    })
  })

  describe('quand un lot intermédiaire suit un lot en échec', () => {
    it('ne reporte pas les échecs passés sur le statut du lot', async () => {
      // Given
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1))

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({
          idPopulation: 'PHASE_A',
          cumul: { nbTraites: 98, nbEchecs: 2, nbEchecsNettoyage: 0 }
        })
      )

      // Then
      expect(suiviJob.succes).to.be.true()
      expect(suiviJob.nbErreurs).to.equal(0)
    })
  })

  describe("quand le nettoyage annexe d'un jeune archivé échoue", () => {
    it('le compte dans nbEchecsNettoyage sans le compter en échec', async () => {
      // Given
      const ids = desIds(5)
      migrationService.recupererIdsDesBeneficiaireAMigrer
        .withArgs('PHASE_A')
        .resolves(ids)
      archiveJeuneService.archiverEnMasse
        .withArgs(ids)
        .resolves({ idsJeunesArchives: ids, nbEchecsNettoyage: 2 })

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({ idPopulation: 'PHASE_A' })
      )

      // Then
      expect(suiviJob.succes).to.be.true()
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: 5,
        nbEchecs: 0,
        nbEchecsNettoyage: 2,
        termine: true
      })
    })
  })

  describe("quand l'exécution d'un lot plante", () => {
    it('arrête la chaîne et retourne un suivi en échec avec le cumul atteint', async () => {
      // Given
      const erreur = new Error('Base indisponible')
      migrationService.recupererIdsDesBeneficiaireAMigrer.rejects(erreur)

      // When
      const suiviJob = await archiverJeunesMigrationJobHandler.handle(
        unJob({
          idPopulation: 'PHASE_A',
          cumul: { nbTraites: 200, nbEchecs: 1, nbEchecsNettoyage: 0 }
        })
      )

      // Then
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
      expect(suiviJob.succes).to.be.false()
      expect(suiviJob.intermediaire).to.be.undefined()
      expect(suiviJob.erreur).to.equal(erreur)
      expect(suiviJob.nbErreurs).to.equal(1)
      expect(suiviJob.resultat).to.deep.equal({
        nbTraites: 200,
        nbEchecs: 1,
        nbEchecsNettoyage: 0,
        termine: false
      })
    })
  })

  describe("quand l'archivage groupé échoue", () => {
    it('rejoue jeune par jeune, compte les jeunes en erreur dans nbEchecs et additionne les échecs de nettoyage', async () => {
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
      archiveJeuneService.archiverEnMasse
        .withArgs(['jeune-003'])
        .resolves({ idsJeunesArchives: ['jeune-003'], nbEchecsNettoyage: 1 })

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
        nbEchecsNettoyage: 1,
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
        nbEchecsNettoyage: 0,
        termine: true
      })
    })
  })
})

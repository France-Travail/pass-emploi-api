import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  ArchiverJeunesMigrationJobHandler,
  LOTS_EN_ECHEC_CONSECUTIFS_MAX,
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
    return Array.from({ length: nombre }, (_, index) => `jeune-${index}`)
  }

  it('archive les jeunes de la population en un seul appel groupé', async () => {
    // Given
    migrationService.recupererIdsDesBeneficiaireAMigrer
      .withArgs('PHASE_A')
      .resolves(['1', '2'])

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A' })
    )

    // Then
    expect(
      archiveJeuneService.archiverEnMasse
    ).to.have.been.calledOnceWithExactly(
      ['1', '2'],
      "Pour des raisons de migration nous avons procédé à l'archivage de votre compte.",
      MotifSuppressionSupport.MIGRATION,
      'PHASE_A'
    )
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suiviJob.succes).to.be.true()
    expect(suiviJob.resultat).to.deep.equal({
      idPopulation: 'PHASE_A',
      nbArchivesDuLot: 2,
      nbEchecsDuLot: 0,
      nbEchecsNettoyageDuLot: 0,
      nbArchives: 2,
      nbEchecs: 0,
      nbRestants: 0,
      termine: true,
      abandonne: false,
      idsEnEchec: []
    })
  })

  it('planifie le lot suivant quand il reste des jeunes à archiver', async () => {
    // Given
    const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1)
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(ids)

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A', nbArchives: 10 })
    )

    // Then
    expect(archiveJeuneService.archiverEnMasse).to.have.been.calledOnceWith(
      ids.slice(0, TAILLE_LOT_ARCHIVAGE_MIGRATION)
    )
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith(
      unJob({
        idPopulation: 'PHASE_A',
        idsEnEchec: [],
        nbArchives: 10 + TAILLE_LOT_ARCHIVAGE_MIGRATION,
        lotsEnEchecConsecutifs: 0
      })
    )
    expect(suiviJob.resultat).to.include({ nbRestants: 1, termine: false })
  })

  it('exclut les jeunes des lots déjà en échec', async () => {
    // Given
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves([
      'deja-en-echec',
      '1'
    ])

    // When
    await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A', idsEnEchec: ['deja-en-echec'] })
    )

    // Then
    expect(archiveJeuneService.archiverEnMasse).to.have.been.calledOnceWith([
      '1'
    ])
  })

  it("rejoue le lot jeune par jeune quand son archivage groupé échoue et n'écarte que les jeunes en erreur", async () => {
    // Given
    const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1)
    const lot = ids.slice(0, TAILLE_LOT_ARCHIVAGE_MIGRATION)
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(ids)
    archiveJeuneService.archiverEnMasse
      .withArgs(lot)
      .rejects(new Error('Donnée invalide'))
    archiveJeuneService.archiverEnMasse
      .withArgs(['jeune-0'])
      .rejects(new Error('Donnée invalide'))

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A' })
    )

    // Then
    expect(archiveJeuneService.archiverEnMasse).to.have.callCount(
      1 + TAILLE_LOT_ARCHIVAGE_MIGRATION
    )
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith(
      unJob({
        idPopulation: 'PHASE_A',
        idsEnEchec: ['jeune-0'],
        nbArchives: TAILLE_LOT_ARCHIVAGE_MIGRATION - 1,
        lotsEnEchecConsecutifs: 0
      })
    )
    expect(suiviJob.succes).to.be.true()
    expect(suiviJob.nbErreurs).to.equal(1)
  })

  it("écarte les jeunes du lot qui n'ont pas été archivés", async () => {
    // Given
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(['1', '2'])
    archiveJeuneService.archiverEnMasse.resolves({
      idsJeunesArchives: ['1'],
      nbEchecsNettoyage: 0
    })

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A' })
    )

    // Then
    expect(suiviJob.resultat).to.include({ nbArchives: 1, nbEchecs: 1 })
  })

  it('compte un lot en échec quand aucun jeune ne peut être archivé', async () => {
    // Given
    const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1)
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(ids)
    archiveJeuneService.archiverEnMasse.rejects(new Error('Base indisponible'))

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({ idPopulation: 'PHASE_A' })
    )

    // Then
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith(
      unJob({
        idPopulation: 'PHASE_A',
        idsEnEchec: ids.slice(0, TAILLE_LOT_ARCHIVAGE_MIGRATION),
        nbArchives: 0,
        lotsEnEchecConsecutifs: 1
      })
    )
    expect(suiviJob.succes).to.be.false()
    expect(suiviJob.nbErreurs).to.equal(TAILLE_LOT_ARCHIVAGE_MIGRATION)
  })

  it('abandonne après trop de lots consécutifs en échec', async () => {
    // Given
    const ids = desIds(TAILLE_LOT_ARCHIVAGE_MIGRATION + 1)
    migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(ids)
    archiveJeuneService.archiverEnMasse.rejects(new Error('Base indisponible'))

    // When
    const suiviJob = await archiverJeunesMigrationJobHandler.handle(
      unJob({
        idPopulation: 'PHASE_A',
        lotsEnEchecConsecutifs: LOTS_EN_ECHEC_CONSECUTIFS_MAX - 1
      })
    )

    // Then
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suiviJob.succes).to.be.false()
    expect(suiviJob.resultat).to.include({
      nbRestants: 1,
      termine: false,
      abandonne: true
    })
  })
})

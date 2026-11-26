import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  DesarchivageJeuneQueryModel,
  DesarchivageJeuneService
} from '../../../src/application/commands/support/desarchivage-jeune.service.db'
import {
  DesarchiverJeunesConseillerJobHandler,
  TAILLE_LOT_DESARCHIVAGE
} from '../../../src/application/jobs/desarchiver-jeunes-conseiller.job.handler'
import { MauvaiseCommandeError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('DesarchiverJeunesConseillerJobHandler', () => {
  let jobHandler: DesarchiverJeunesConseillerJobHandler
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let desarchivageService: StubbedClass<DesarchivageJeuneService>

  const maintenant = uneDatetime()
  const idConseiller = 'conseiller-cible'

  beforeEach(async () => {
    await getDatabase().cleanPG()
    await ConseillerSqlModel.creer(unConseillerDto({ id: idConseiller }))

    const sandbox = createSandbox()
    const planificateurRepository =
      stubInterface<Planificateur.Repository>(sandbox)
    archiveJeuneRepository = stubInterface<ArchiveJeune.Repository>(sandbox)
    desarchivageService = stubClass(DesarchivageJeuneService)
    const dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())

    jobHandler = new DesarchiverJeunesConseillerJobHandler(
      stubInterface<SuiviJob.Service>(sandbox),
      dateService,
      planificateurRepository,
      archiveJeuneRepository,
      desarchivageService
    )
  })

  function unJob(
    apresId?: string
  ): Planificateur.Job<Planificateur.JobDesarchiverJeunesConseiller> {
    return {
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER,
      contenu: { idConseiller, apresId }
    }
  }

  it('reprend les archives du conseiller après le dernier id traité', async () => {
    // Given
    archiveJeuneRepository.idsArchivesMigrationDuConseiller.resolves([])

    // When
    await jobHandler.handle(unJob('9'))

    // Then
    expect(
      archiveJeuneRepository.idsArchivesMigrationDuConseiller
    ).to.have.been.calledWith({
      idConseiller,
      taille: TAILLE_LOT_DESARCHIVAGE,
      apresId: 9
    })
  })

  it("désarchive chaque archive pour le conseiller et fait le bilan, sans s'arrêter sur un échec", async () => {
    // Given
    archiveJeuneRepository.idsArchivesMigrationDuConseiller.resolves([1, 2, 3])
    desarchivageService.desarchiver
      .withArgs(1)
      .resolves(success({} as DesarchivageJeuneQueryModel))
    desarchivageService.desarchiver
      .withArgs(2)
      .resolves(failure(new MauvaiseCommandeError('autre conseiller')))
    desarchivageService.desarchiver.withArgs(3).rejects(new Error('Firebase'))

    // When
    const suiviJob = await jobHandler.handle(unJob())

    // Then
    expect(desarchivageService.desarchiver).to.have.callCount(3)
    expect(desarchivageService.desarchiver).to.have.been.calledWith(
      1,
      idConseiller
    )
    expect(suiviJob.resultat).to.deep.include({
      nbTraites: 1,
      nbIgnores: 1,
      nbEchecs: 1
    })
  })
})

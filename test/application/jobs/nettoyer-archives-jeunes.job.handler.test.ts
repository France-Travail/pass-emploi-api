import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, SinonSandbox } from 'sinon'
import {
  NettoyerArchivesJeunesJobHandler,
  TAILLE_LOT_NETTOYAGE_ARCHIVES
} from '../../../src/application/jobs/nettoyer-archives-jeunes.job.handler'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('NettoyerArchivesJeunesJobHandler', () => {
  let nettoyerArchivesJeunesJobHandler: NettoyerArchivesJeunesJobHandler
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let archiveJeuneService: StubbedClass<ArchiveJeune.Service>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let sandbox: SinonSandbox

  const maintenant = uneDatetime()

  beforeEach(() => {
    sandbox = createSandbox()
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    planificateurRepository.chaineDeLotsEnCours.resolves(false)
    archiveJeuneRepository = stubInterface<ArchiveJeune.Repository>(sandbox)
    archiveJeuneRepository.idsArchivesANettoyer.resolves([])
    archiveJeuneService = stubClass(ArchiveJeune.Service)
    archiveJeuneService.nettoyerLesArchives.callsFake(async ids => ({
      nbTraites: ids.length,
      nbEchecs: 0,
      nbEchecsIdp: 0,
      nbEchecsChat: 0
    }))
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())
    suiviJobService = stubInterface<SuiviJob.Service>(sandbox)

    nettoyerArchivesJeunesJobHandler = new NettoyerArchivesJeunesJobHandler(
      suiviJobService,
      dateService,
      planificateurRepository,
      archiveJeuneRepository,
      archiveJeuneService
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  function unJob(
    contenu?: Planificateur.JobNettoyerArchivesJeunes
  ): Planificateur.Job<Planificateur.JobNettoyerArchivesJeunes> {
    return {
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
      contenu
    }
  }

  function desIds(nombre: number): number[] {
    return Array.from({ length: nombre }, (_, index) => index + 1)
  }

  it('nettoie le premier lot et se replanifie avec apresId quand le lot est plein', async () => {
    // Given
    const ids = desIds(TAILLE_LOT_NETTOYAGE_ARCHIVES)
    archiveJeuneRepository.idsArchivesANettoyer.resolves(ids)

    // When
    const suiviJob = await nettoyerArchivesJeunesJobHandler.handle(unJob({}))

    // Then
    expect(
      archiveJeuneService.nettoyerLesArchives
    ).to.have.been.calledOnceWithExactly(ids)
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
      contenu: {
        apresId: String(TAILLE_LOT_NETTOYAGE_ARCHIVES),
        jobRunId: undefined,
        cumul: {
          nbTraites: TAILLE_LOT_NETTOYAGE_ARCHIVES,
          nbEchecs: 0,
          nbEchecsIdp: 0,
          nbEchecsChat: 0
        }
      }
    })
    expect(suiviJob.intermediaire).to.be.true()
  })

  it('accepte un job de cron sans contenu', async () => {
    // When
    const suiviJob = await nettoyerArchivesJeunesJobHandler.handle(unJob())

    // Then
    expect(
      archiveJeuneRepository.idsArchivesANettoyer
    ).to.have.been.calledOnceWithExactly({
      taille: TAILLE_LOT_NETTOYAGE_ARCHIVES,
      apresId: undefined,
      idPopulation: undefined
    })
    expect(suiviJob.succes).to.be.true()
  })

  it('se restreint à la population du contenu et la porte dans les labels', async () => {
    // Given
    const job = unJob({ idPopulation: 'PHASE_A', apresId: '42' })

    // When
    await nettoyerArchivesJeunesJobHandler.handle(job)

    // Then
    expect(
      archiveJeuneRepository.idsArchivesANettoyer
    ).to.have.been.calledOnceWithExactly({
      taille: TAILLE_LOT_NETTOYAGE_ARCHIVES,
      apresId: 42,
      idPopulation: 'PHASE_A'
    })
    expect(nettoyerArchivesJeunesJobHandler['labelsDuLog'](job)).to.deep.equal({
      population_id: 'PHASE_A'
    })
    expect(
      nettoyerArchivesJeunesJobHandler['labelsDuLog'](unJob())
    ).to.be.undefined()
  })

  it('ne démarre pas de seconde chaîne quand une chaîne est en cours', async () => {
    // Given
    planificateurRepository.chaineDeLotsEnCours
      .withArgs(Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES)
      .resolves(true)

    // When
    const suiviJob = await nettoyerArchivesJeunesJobHandler.handle(unJob())

    // Then
    expect(
      archiveJeuneRepository.idsArchivesANettoyer
    ).not.to.have.been.called()
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suiviJob.succes).to.be.true()
    expect(suiviJob.intermediaire).to.be.false()
    expect(suiviJob.nbErreurs).to.equal(0)
    expect(suiviJob.resultat).to.deep.equal({ chaineDejaEnCours: true })
  })

  it('ne vérifie pas la chaîne en cours pour un lot de suite', async () => {
    // When
    await nettoyerArchivesJeunesJobHandler.handle(unJob({ apresId: '10' }))

    // Then
    expect(
      planificateurRepository.chaineDeLotsEnCours
    ).not.to.have.been.called()
  })

  it('porte le bilan cumulé et termine au dernier lot', async () => {
    // Given
    archiveJeuneRepository.idsArchivesANettoyer.resolves([11, 12, 13])
    archiveJeuneService.nettoyerLesArchives.resolves({
      nbTraites: 2,
      nbEchecs: 1,
      nbEchecsIdp: 1,
      nbEchecsChat: 0
    })

    // When
    const suiviJob = await nettoyerArchivesJeunesJobHandler.handle(
      unJob({
        apresId: '10',
        cumul: { nbTraites: 9, nbEchecs: 1, nbEchecsIdp: 0, nbEchecsChat: 1 }
      })
    )

    // Then
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suiviJob.succes).to.be.false()
    expect(suiviJob.resultat).to.deep.equal({
      nbTraites: 11,
      nbEchecs: 2,
      nbEchecsIdp: 1,
      nbEchecsChat: 1,
      termine: true
    })
  })
})

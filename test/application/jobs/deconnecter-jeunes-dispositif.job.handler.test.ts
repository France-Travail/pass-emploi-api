import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, SinonSandbox } from 'sinon'
import {
  DeconnecterJeunesDispositifJobHandler,
  PAUSE_ENTRE_DECONNEXIONS_MS,
  TAILLE_LOT_DECONNEXION_DISPOSITIF
} from '../../../src/application/jobs/deconnecter-jeunes-dispositif.job.handler'
import { Authentification } from '../../../src/domain/authentification'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Planificateur } from '../../../src/domain/planificateur'
import { Profil } from '../../../src/domain/profil'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('DeconnecterJeunesDispositifJobHandler', () => {
  let handler: DeconnecterJeunesDispositifJobHandler
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let dateService: StubbedClass<DateService>
  let sandbox: SinonSandbox

  const maintenant = uneDatetime()

  beforeEach(() => {
    sandbox = createSandbox()
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    jeuneRepository = stubInterface<Jeune.Repository>(sandbox)
    authentificationRepository =
      stubInterface<Authentification.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())

    handler = new DeconnecterJeunesDispositifJobHandler(
      stubInterface<SuiviJob.Service>(sandbox),
      dateService,
      planificateurRepository,
      jeuneRepository,
      authentificationRepository
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  function unJob(
    contenu: Partial<Planificateur.JobDeconnecterJeunesDispositif> = {}
  ): Planificateur.Job<Planificateur.JobDeconnecterJeunesDispositif> {
    return {
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF,
      contenu: { dispositif: Profil.Dispositif.AIJ, ...contenu }
    }
  }

  function desIds(nombre: number): string[] {
    return Array.from(
      { length: nombre },
      (_, index) => `auth-${String(index).padStart(3, '0')}`
    )
  }

  it('déconnecte les jeunes un par un, avec une pause après chaque appel', async () => {
    // Given
    jeuneRepository.recupererIdsAuthentificationDuDispositif
      .withArgs(
        Profil.Dispositif.AIJ,
        TAILLE_LOT_DECONNEXION_DISPOSITIF,
        undefined
      )
      .resolves(['auth-1', 'auth-2'])

    // When
    const suiviJob = await handler.handle(unJob())

    // Then
    const supprimer = authentificationRepository.supprimerCompteIdp
    expect(supprimer.firstCall).to.have.been.calledWithExactly('auth-1')
    expect(supprimer.secondCall).to.have.been.calledWithExactly('auth-2')
    expect(dateService.attendre).to.have.been.calledTwice()
    expect(dateService.attendre).to.have.been.calledWithExactly(
      PAUSE_ENTRE_DECONNEXIONS_MS
    )
    expect(
      supprimer.firstCall.calledBefore(dateService.attendre.firstCall)
    ).to.be.true()
    expect(
      dateService.attendre.firstCall.calledBefore(supprimer.secondCall)
    ).to.be.true()
    expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    expect(suiviJob.succes).to.be.true()
    expect(suiviJob.resultat).to.deep.equal({
      nbTraites: 2,
      nbEchecs: 0,
      termine: true
    })
  })

  it('se replanifie après le dernier id quand le lot est plein', async () => {
    // Given
    const ids = desIds(TAILLE_LOT_DECONNEXION_DISPOSITIF)
    jeuneRepository.recupererIdsAuthentificationDuDispositif.resolves(ids)

    // When
    await handler.handle(unJob())

    // Then
    expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
      dateExecution: maintenant.toJSDate(),
      type: Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF,
      contenu: {
        dispositif: Profil.Dispositif.AIJ,
        apresId: ids.at(-1),
        jobRunId: undefined,
        cumul: { nbTraites: ids.length, nbEchecs: 0 }
      }
    })
  })

  it('reprend après apresId', async () => {
    // Given
    jeuneRepository.recupererIdsAuthentificationDuDispositif.resolves([])

    // When
    await handler.handle(unJob({ apresId: 'auth-099' }))

    // Then
    expect(
      jeuneRepository.recupererIdsAuthentificationDuDispositif
    ).to.have.been.calledOnceWithExactly(
      Profil.Dispositif.AIJ,
      TAILLE_LOT_DECONNEXION_DISPOSITIF,
      'auth-099'
    )
  })

  it('continue après un échec et le compte dans le bilan, sans perdre la pause', async () => {
    // Given
    jeuneRepository.recupererIdsAuthentificationDuDispositif.resolves([
      'auth-ko',
      'auth-ok'
    ])
    authentificationRepository.supprimerCompteIdp
      .withArgs('auth-ko')
      .rejects(new Error('connect injoignable'))
    authentificationRepository.supprimerCompteIdp.withArgs('auth-ok').resolves()

    // When
    const suiviJob = await handler.handle(unJob())

    // Then
    expect(
      authentificationRepository.supprimerCompteIdp
    ).to.have.been.calledWithExactly('auth-ok')
    expect(dateService.attendre).to.have.been.calledTwice()
    expect(suiviJob.succes).to.be.false()
    expect(suiviJob.nbErreurs).to.equal(1)
    expect(suiviJob.resultat).to.deep.equal({
      nbTraites: 1,
      nbEchecs: 1,
      termine: true
    })
  })
})

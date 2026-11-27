import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { DesarchiverJeunesConseillerCommandHandler } from '../../../../src/application/commands/support/desarchiver-jeunes-conseiller.command.handler'
import { DesarchivageJeuneService } from '../../../../src/application/commands/support/desarchivage-jeune.service.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  failure,
  isSuccess,
  success
} from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { Planificateur } from '../../../../src/domain/planificateur'
import { DateService } from '../../../../src/utils/date-service'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('DesarchiverJeunesConseillerCommandHandler', () => {
  let handler: DesarchiverJeunesConseillerCommandHandler
  let desarchivageService: StubbedClass<DesarchivageJeuneService>
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>
  const sandbox = createSandbox()

  const maintenant = new Date('2026-11-26T10:00:00Z')

  beforeEach(() => {
    desarchivageService = stubClass(DesarchivageJeuneService)
    archiveJeuneRepository = stubInterface<ArchiveJeune.Repository>(sandbox)
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    planificateurRepository.chaineDeLotsEnCours.resolves(false)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)

    handler = new DesarchiverJeunesConseillerCommandHandler(
      desarchivageService,
      archiveJeuneRepository,
      planificateurRepository,
      dateService
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it("propage l'erreur quand le conseiller n'est pas trouvé", async () => {
      // Given
      const erreur = failure(
        new NonTrouveError("Conseiller avec l'email", 'inconnu@example.com')
      )
      desarchivageService.trouverLeConseiller
        .withArgs('inconnu@example.com')
        .resolves(erreur)

      // When
      const result = await handler.handle({
        emailConseiller: 'inconnu@example.com'
      })

      // Then
      expect(result).to.deep.equal(erreur)
      expect(
        archiveJeuneRepository.idsArchivesMigrationDuConseiller
      ).not.to.have.been.called()
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it("retourne MauvaiseCommandeError quand aucune archive Migration n'existe pour le conseiller", async () => {
      // Given
      const idConseiller = 'conseiller-id'

      desarchivageService.trouverLeConseiller
        .withArgs('conseiller@example.com')
        .resolves(success(idConseiller))

      archiveJeuneRepository.idsArchivesMigrationDuConseiller
        .withArgs({ idConseiller: 'conseiller-id', taille: 1 })
        .resolves([])

      // When
      const result = await handler.handle({
        emailConseiller: 'conseiller@example.com'
      })

      // Then
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            'Aucune archive au motif Migration pour le conseiller conseiller-id'
          )
        )
      )
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })

    it("planifie le job de désarchivage avec l'idConseiller", async () => {
      // Given
      const idConseiller = 'conseiller-id'

      desarchivageService.trouverLeConseiller
        .withArgs('conseiller@example.com')
        .resolves(success(idConseiller))

      archiveJeuneRepository.idsArchivesMigrationDuConseiller
        .withArgs({ idConseiller: 'conseiller-id', taille: 1 })
        .resolves([123])

      // When
      const result = await handler.handle({
        emailConseiller: 'conseiller@example.com'
      })

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(isSuccess(result) && result.data).to.deep.equal({
        idConseiller: 'conseiller-id'
      })
      expect(
        planificateurRepository.ajouterJob
      ).to.have.been.calledOnceWithExactly({
        dateExecution: maintenant,
        type: Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER,
        contenu: { idConseiller: 'conseiller-id' }
      })
    })

    it('refuse de lancer un second désarchivage en masse pendant une chaîne en cours', async () => {
      // Given
      desarchivageService.trouverLeConseiller.resolves(success('conseiller-id'))
      archiveJeuneRepository.idsArchivesMigrationDuConseiller.resolves([123])
      planificateurRepository.chaineDeLotsEnCours
        .withArgs(Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER)
        .resolves(true)

      // When
      const result = await handler.handle({
        emailConseiller: 'conseiller@example.com'
      })

      // Then
      expect(isSuccess(result)).to.be.false()
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })
  })
})

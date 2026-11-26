import { DesarchiverJeuneCommandHandler } from '../../../../src/application/commands/support/desarchiver-jeune.command.handler'
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
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('DesarchiverJeuneCommandHandler', () => {
  let handler: DesarchiverJeuneCommandHandler
  let desarchivageService: StubbedClass<DesarchivageJeuneService>

  beforeEach(() => {
    desarchivageService = stubClass(DesarchivageJeuneService)
    handler = new DesarchiverJeuneCommandHandler(desarchivageService)
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
        idArchive: 1,
        emailConseiller: 'inconnu@example.com'
      })

      // Then
      expect(result).to.deep.equal(erreur)
      expect(desarchivageService.desarchiver).not.to.have.been.called()
    })

    it("propage l'erreur quand plusieurs conseillers ont le même email", async () => {
      // Given
      const erreur = failure(
        new MauvaiseCommandeError(
          "Plusieurs conseillers ont l'email test@example.com : id1 (MILO), id2 (POLE_EMPLOI)"
        )
      )
      desarchivageService.trouverLeConseiller
        .withArgs('test@example.com')
        .resolves(erreur)

      // When
      const result = await handler.handle({
        idArchive: 1,
        emailConseiller: 'test@example.com'
      })

      // Then
      expect(result).to.deep.equal(erreur)
      expect(desarchivageService.desarchiver).not.to.have.been.called()
    })

    it('appelle desarchiver avec le conseiller trouvé', async () => {
      // Given
      const idConseiller = 'conseiller-id'

      desarchivageService.trouverLeConseiller
        .withArgs('conseiller@example.com')
        .resolves(success(idConseiller))

      const resultatDesarchivage = success({
        idJeune: 'jeune-id',
        fusionAvecCompteRecree: false,
        rattacheAuConseiller: false,
        actionsRestaurees: 1,
        rendezVousRestaures: 1,
        actionsIgnoreesDoublon: 0,
        rendezVousIgnoresDoublon: 0,
        animationsCollectivesNonRestaurees: 0,
        favorisRestaures: 2,
        recherchesRestaurees: 1,
        messagesRestaures: 3
      })
      desarchivageService.desarchiver
        .withArgs(42, idConseiller)
        .resolves(resultatDesarchivage)

      // When
      const result = await handler.handle({
        idArchive: 42,
        emailConseiller: 'conseiller@example.com'
      })

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(result).to.deep.equal(resultatDesarchivage)
      expect(
        desarchivageService.desarchiver
      ).to.have.been.calledOnceWithExactly(42, idConseiller)
    })

    it("propage l'erreur de désarchivage", async () => {
      // Given
      const idConseiller = 'conseiller-id'

      desarchivageService.trouverLeConseiller
        .withArgs('conseiller@example.com')
        .resolves(success(idConseiller))

      const erreurDesarchivage = failure(
        new NonTrouveError('ArchiveJeune', '999')
      )
      desarchivageService.desarchiver
        .withArgs(999, idConseiller)
        .resolves(erreurDesarchivage)

      // When
      const result = await handler.handle({
        idArchive: 999,
        emailConseiller: 'conseiller@example.com'
      })

      // Then
      expect(result).to.deep.equal(erreurDesarchivage)
    })
  })
})

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { ModifierDispositifFTConseillerCommandHandler } from '../../../../src/application/commands/support/modifier-dispositif-ft-conseiller.command.handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  Failure
} from '../../../../src/building-blocks/types/result'
import { Authentification } from '../../../../src/domain/authentification'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { Conseiller } from '../../../../src/domain/milo/conseiller'
import { Profil } from '../../../../src/domain/profil'
import { DateService } from '../../../../src/utils/date-service'
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('ModifierDispositifFTConseillerCommandHandler', () => {
  const maintenant = DateTime.fromISO('2026-09-22T10:00:00.000Z')
  const idConseiller = 'id-conseiller'

  let conseillerRepository: StubbedType<Conseiller.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let dateService: StubbedClass<DateService>
  let handler: ModifierDispositifFTConseillerCommandHandler

  beforeEach(() => {
    const sandbox = createSandbox()
    conseillerRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    jeuneRepository.changerDispositifDesJeunesDuConseiller.resolves([])
    authentificationRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new ModifierDispositifFTConseillerCommandHandler(
      conseillerRepository,
      jeuneRepository,
      authentificationRepository,
      dateService
    )
  })

  describe('handle', () => {
    it("renvoie une failure quand le conseiller n'existe pas", async () => {
      // Given
      conseillerRepository.get.withArgs(idConseiller).resolves(undefined)

      // When
      const result = await handler.handle({
        idConseiller,
        dispositif: Profil.Dispositif.CEJ
      })

      // Then
      expect((result as Failure).error).to.deep.equal(
        new NonTrouveError('Conseiller', idConseiller)
      )
      expect(conseillerRepository.save).not.to.have.been.called()
    })

    it("renvoie une failure quand le conseiller n'est pas France Travail", async () => {
      // Given
      conseillerRepository.get.withArgs(idConseiller).resolves(
        unConseiller({
          id: idConseiller,
          structure: Profil.Structure.MILO,
          dispositif: null
        })
      )

      // When
      const result = await handler.handle({
        idConseiller,
        dispositif: Profil.Dispositif.CEJ
      })

      // Then
      expect((result as Failure).error).to.be.instanceOf(MauvaiseCommandeError)
      expect(conseillerRepository.save).not.to.have.been.called()
    })

    it("renvoie une failure quand le dispositif n'est pas proposé aux conseillers France Travail", async () => {
      // Given
      conseillerRepository.get
        .withArgs(idConseiller)
        .resolves(unConseiller({ id: idConseiller }))

      // When
      const result = await handler.handle({
        idConseiller,
        dispositif: Profil.Dispositif.PACEA
      })

      // Then
      expect((result as Failure).error).to.be.instanceOf(MauvaiseCommandeError)
      expect(conseillerRepository.save).not.to.have.been.called()
    })

    it('pose la date de mise à jour sans rien basculer quand le dispositif est déjà le sien', async () => {
      // Given
      const conseillerCEJ = unConseiller({
        id: idConseiller,
        dispositif: Profil.Dispositif.CEJ,
        dateMajDispositif: maintenant.minus({ years: 2 })
      })
      conseillerRepository.get.withArgs(idConseiller).resolves(conseillerCEJ)

      // When
      const result = await handler.handle({
        idConseiller,
        dispositif: Profil.Dispositif.CEJ
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(conseillerRepository.save).to.have.been.calledOnceWithExactly({
        ...conseillerCEJ,
        dateMajDispositif: maintenant
      })
      expect(
        jeuneRepository.changerDispositifDesJeunesDuConseiller
      ).not.to.have.been.called()
      expect(
        authentificationRepository.deleteUtilisateurIdp
      ).not.to.have.been.called()
    })

    it('change le dispositif, bascule les jeunes du conseiller et déconnecte tout le monde', async () => {
      // Given
      const conseillerCEJ = unConseiller({
        id: idConseiller,
        dispositif: Profil.Dispositif.CEJ
      })
      conseillerRepository.get.withArgs(idConseiller).resolves(conseillerCEJ)
      jeuneRepository.changerDispositifDesJeunesDuConseiller.resolves([
        'jeune-1',
        'jeune-2'
      ])

      // When
      const result = await handler.handle({
        idConseiller,
        dispositif: Profil.Dispositif.AIJ
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(conseillerRepository.save).to.have.been.calledOnceWithExactly({
        ...conseillerCEJ,
        dispositif: Profil.Dispositif.AIJ,
        dateMajDispositif: maintenant
      })
      expect(
        jeuneRepository.changerDispositifDesJeunesDuConseiller
      ).to.have.been.calledOnceWithExactly(idConseiller, Profil.Dispositif.AIJ)
      expect(
        authentificationRepository.deleteUtilisateurIdp
      ).to.have.been.calledThrice()
      expect(
        authentificationRepository.deleteUtilisateurIdp
      ).to.have.been.calledWithExactly('jeune-1')
      expect(
        authentificationRepository.deleteUtilisateurIdp
      ).to.have.been.calledWithExactly('jeune-2')
      expect(
        authentificationRepository.deleteUtilisateurIdp
      ).to.have.been.calledWithExactly(idConseiller)
    })
  })

  describe('authorize', () => {
    it('autorise le support', async () => {
      // When
      const result = await handler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})

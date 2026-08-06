import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { SinonSandbox } from 'sinon'
import { ConseillerAuthorizer } from 'src/application/authorizers/conseiller-authorizer'
import {
  UpdateActualiteMiloCommand,
  UpdateActualiteMiloCommandHandler
} from 'src/application/commands/milo/update-actualite-milo.command.handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  isFailure,
  isSuccess
} from 'src/building-blocks/types/result'
import { Core } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('UpdateActualiteMiloCommandHandler', () => {
  let updateActualiteMiloCommandHandler: UpdateActualiteMiloCommandHandler
  let actualiteMiloRepository: StubbedType<ActualiteMilo.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let evenementService: StubbedClass<EvenementService>

  const idActualite = 'id-actualite'
  const idConseiller = 'conseiller-1'
  const maintenant = DateTime.fromISO('2024-06-01T10:00:00.000Z')
  const dateCreation = DateTime.fromISO('2024-01-15T10:00:00.000Z')

  const uneActualiteExistante: ActualiteMilo = {
    id: idActualite,
    idStructureMilo: 'agence-1',
    idConseiller,
    prenomNomConseiller: 'Nils Tavernier',
    titre: 'Ancien titre',
    contenu: 'Ancien contenu',
    dateCreation,
    dateModification: undefined,
    dateSuppression: undefined
  }

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    actualiteMiloRepository = stubInterface(sandbox)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    evenementService = stubClass(EvenementService)
    const dateService = stubClass(DateService)
    const idService = stubClass(IdService)
    dateService.now.returns(maintenant)

    updateActualiteMiloCommandHandler = new UpdateActualiteMiloCommandHandler(
      conseillerAuthorizer,
      actualiteMiloRepository,
      new ActualiteMilo.Factory(idService, dateService),
      evenementService
    )
  })

  describe('authorize', () => {
    it('autorise le conseiller Milo', async () => {
      // Given
      const command: UpdateActualiteMiloCommand = {
        idActualite,
        idConseiller,
        titre: 'Nouveau titre',
        contenu: 'Nouveau contenu'
      }
      const utilisateur = unUtilisateurConseiller({
        structure: Core.Structure.MILO
      })
      conseillerAuthorizer.autoriserLeConseiller.resolves(emptySuccess())

      // When
      const result = await updateActualiteMiloCommandHandler.authorize(
        command,
        utilisateur
      )

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledWith(idConseiller, utilisateur)
    })
  })

  describe('handle', () => {
    it("met à jour l'actualité quand le conseiller en est propriétaire", async () => {
      // Given
      const command: UpdateActualiteMiloCommand = {
        idActualite,
        idConseiller,
        titre: 'Nouveau titre',
        contenu: 'Nouveau contenu',
        titreLien: 'En savoir plus',
        lien: 'https://example.com'
      }
      actualiteMiloRepository.get
        .withArgs(idActualite)
        .resolves(uneActualiteExistante)
      actualiteMiloRepository.save.resolves()

      // When
      const result = await updateActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(actualiteMiloRepository.save).to.have.been.calledOnce()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite).to.deep.equal({
        id: idActualite,
        idStructureMilo: 'agence-1',
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Nouveau titre',
        contenu: 'Nouveau contenu',
        titreLien: 'En savoir plus',
        lien: 'https://example.com',
        dateCreation,
        dateModification: maintenant,
        dateSuppression: undefined
      })
    })

    it('applique le titre de lien par défaut quand un lien est fourni sans titre', async () => {
      // Given
      const command: UpdateActualiteMiloCommand = {
        idActualite,
        idConseiller,
        titre: 'Nouveau titre',
        contenu: 'Nouveau contenu',
        lien: 'https://example.com'
      }
      actualiteMiloRepository.get
        .withArgs(idActualite)
        .resolves(uneActualiteExistante)
      actualiteMiloRepository.save.resolves()

      // When
      const result = await updateActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite.titreLien).to.equal('En savoir plus')
      expect(savedActualite.lien).to.equal('https://example.com')
    })

    it("retourne une NonTrouveError quand l'actualité n'existe pas", async () => {
      // Given
      const command: UpdateActualiteMiloCommand = {
        idActualite,
        idConseiller,
        titre: 'Titre',
        contenu: 'Contenu'
      }
      actualiteMiloRepository.get.withArgs(idActualite).resolves(undefined)

      // When
      const result = await updateActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error).to.be.instanceOf(NonTrouveError)
        expect(result.error.message).to.contain('Actualite')
      }
    })

    it("retourne une DroitsInsuffisants quand le conseiller n'est pas propriétaire", async () => {
      // Given
      const command: UpdateActualiteMiloCommand = {
        idActualite,
        idConseiller: 'autre-conseiller',
        titre: 'Titre',
        contenu: 'Contenu'
      }
      actualiteMiloRepository.get
        .withArgs(idActualite)
        .resolves(uneActualiteExistante)

      // When
      const result = await updateActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error).to.be.instanceOf(DroitsInsuffisants)
      }
    })
  })

  describe('monitor', () => {
    it("crée un événement de modification d'actualité", async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()

      // When
      await updateActualiteMiloCommandHandler.monitor(utilisateur)

      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.ACTUALITE_MILO_MODIFIEE,
        utilisateur
      )
    })
  })
})

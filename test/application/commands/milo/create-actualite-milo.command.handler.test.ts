import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { SinonSandbox } from 'sinon'
import { ConseillerAuthorizer } from 'src/application/authorizers/conseiller-authorizer'
import {
  CreateActualiteMiloCommand,
  CreateActualiteMiloCommandHandler
} from 'src/application/commands/milo/create-actualite-milo.command.handler'
import { NonTrouveError } from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  isFailure,
  isSuccess
} from 'src/building-blocks/types/result'
import { Core } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { Jeune } from 'src/domain/jeune/jeune'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { Conseiller } from 'src/domain/milo/conseiller'
import { Notification } from 'src/domain/notification/notification'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('CreateActualiteMiloCommandHandler', () => {
  let createActualiteMiloCommandHandler: CreateActualiteMiloCommandHandler
  let actualiteMiloRepository: StubbedType<ActualiteMilo.Repository>
  let conseillerRepository: StubbedType<Conseiller.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let evenementService: StubbedClass<EvenementService>
  let notificationService: StubbedClass<Notification.Service>
  const idActualite = 'id-actualite'
  const date = DateTime.fromISO('2024-01-15T10:00:00.000Z')
  const idConseiller = 'conseiller-1'
  const idAgence = 'agence-1'

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    actualiteMiloRepository = stubInterface(sandbox)
    conseillerRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    evenementService = stubClass(EvenementService)
    notificationService = stubClass(Notification.Service)
    const dateService = stubClass(DateService)
    const idService = stubClass(IdService)
    idService.uuid.returns(idActualite)
    dateService.now.returns(date)

    createActualiteMiloCommandHandler = new CreateActualiteMiloCommandHandler(
      conseillerAuthorizer,
      actualiteMiloRepository,
      new ActualiteMilo.Factory(idService, dateService),
      evenementService,
      conseillerRepository,
      jeuneRepository,
      notificationService
    )
  })

  describe('authorize', () => {
    it('autorise le conseiller', async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Titre',
        contenu: 'Contenu'
      }
      const utilisateur = unUtilisateurConseiller({
        structure: Core.Structure.MILO
      })
      conseillerAuthorizer.autoriserLeConseiller.resolves(emptySuccess())

      // When
      const result = await createActualiteMiloCommandHandler.authorize(
        command,
        utilisateur
      )

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledWith(idConseiller, utilisateur, true)
    })
  })

  describe('handle', () => {
    it('crée une actualité avec les informations fournies', async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Nouvelle actualité',
        contenu: 'Description de actualité',
        titreLien: 'En savoir plus',
        lien: 'https://example.com'
      }
      conseillerRepository.get.withArgs(idConseiller).resolves({
        id: idConseiller,
        agence: { id: idAgence }
      } as Conseiller)
      actualiteMiloRepository.save.resolves()

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(actualiteMiloRepository.save).to.have.been.calledOnce()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite).to.deep.equal({
        id: idActualite,
        idStructureMilo: idAgence,
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Nouvelle actualité',
        contenu: 'Description de actualité',
        titreLien: 'En savoir plus',
        lien: 'https://example.com',
        dateCreation: date,
        dateModification: undefined,
        dateSuppression: undefined
      })
    })

    it('crée une actualité avec titre de lien par défaut quand un lien est fourni sans titre', async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Actualité avec lien',
        contenu: 'Description',
        lien: 'https://example.com'
      }
      conseillerRepository.get.withArgs(idConseiller).resolves({
        id: idConseiller,
        agence: { id: idAgence }
      } as Conseiller)
      actualiteMiloRepository.save.resolves()

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite.titreLien).to.equal('En savoir plus')
      expect(savedActualite.lien).to.equal('https://example.com')
    })

    it('crée une actualité sans lien optionnel', async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Actualité sans lien',
        contenu: 'Description'
      }
      conseillerRepository.get.withArgs(idConseiller).resolves({
        id: idConseiller,
        agence: { id: idAgence }
      } as Conseiller)
      actualiteMiloRepository.save.resolves()

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite.titreLien).to.be.undefined()
      expect(savedActualite.lien).to.be.undefined()
    })

    it("retourne une erreur quand le conseiller n'existe pas", async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Titre',
        contenu: 'Contenu'
      }
      conseillerRepository.get.withArgs(idConseiller).resolves(undefined)

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error).to.be.instanceOf(NonTrouveError)
        expect(result.error.message).to.contain('Conseiller')
      }
    })

    it("retourne une erreur quand le conseiller n'a pas d'agence", async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Titre',
        contenu: 'Contenu'
      }
      conseillerRepository.get.withArgs(idConseiller).resolves({
        id: idConseiller,
        agence: undefined
      } as Conseiller)

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error).to.be.instanceOf(NonTrouveError)
        expect(result.error.message).to.contain('Agence')
      }
    })

    describe('notification', () => {
      it('envoie une notification aux jeunes de la structure après création', async () => {
        // Given
        const command: CreateActualiteMiloCommand = {
          idConseiller,
          prenomNomConseiller: 'Nils Tavernier',
          titre: 'Titre',
          contenu: 'Contenu'
        }
        conseillerRepository.get.withArgs(idConseiller).resolves({
          id: idConseiller,
          agence: { id: idAgence }
        } as Conseiller)
        actualiteMiloRepository.save.resolves()
        const jeunes = [unJeune()]
        jeuneRepository.findAllByIdStructureMilo
          .withArgs(idAgence)
          .resolves(jeunes)

        // When
        await createActualiteMiloCommandHandler.handle(command)

        // Then
        expect(
          notificationService.notifierNouvelleActualite
        ).to.have.been.calledOnceWithExactly(jeunes, idActualite)
      })

      it("n'envoie pas de notification si aucun jeune dans la structure", async () => {
        // Given
        const command: CreateActualiteMiloCommand = {
          idConseiller,
          prenomNomConseiller: 'Nils Tavernier',
          titre: 'Titre',
          contenu: 'Contenu'
        }
        conseillerRepository.get.withArgs(idConseiller).resolves({
          id: idConseiller,
          agence: { id: idAgence }
        } as Conseiller)
        actualiteMiloRepository.save.resolves()
        jeuneRepository.findAllByIdStructureMilo.withArgs(idAgence).resolves([])

        // When
        await createActualiteMiloCommandHandler.handle(command)

        // Then
        expect(
          notificationService.notifierNouvelleActualite
        ).to.have.been.calledOnceWithExactly([], idActualite)
      })
    })
  })

  describe('monitor', () => {
    it("crée un événement de création d'actualité", async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()

      // When
      await createActualiteMiloCommandHandler.monitor(utilisateur)

      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.ACTUALITE_MILO_CREEE,
        utilisateur
      )
    })
  })
})

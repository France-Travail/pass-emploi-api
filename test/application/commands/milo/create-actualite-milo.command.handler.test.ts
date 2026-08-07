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
  failure,
  isFailure,
  isSuccess,
  success
} from 'src/building-blocks/types/result'
import { Core } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { ConseillerMilo } from 'src/domain/milo/conseiller.milo.db'
import { Planificateur } from 'src/domain/planificateur'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('CreateActualiteMiloCommandHandler', () => {
  let createActualiteMiloCommandHandler: CreateActualiteMiloCommandHandler
  let actualiteMiloRepository: StubbedType<ActualiteMilo.Repository>
  let conseillerMiloRepository: StubbedType<ConseillerMilo.Repository>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let evenementService: StubbedClass<EvenementService>
  let dateService: StubbedClass<DateService>
  const idActualite = 'id-actualite'
  const date = DateTime.fromISO('2024-01-15T10:00:00.000Z')
  const idConseiller = 'conseiller-1'
  const idStructureMilo = 'structure-milo-1'

  const unConseillerMilo = (): ConseillerMilo => ({
    id: idConseiller,
    structure: { id: idStructureMilo, timezone: 'Europe/Paris' }
  })

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    actualiteMiloRepository = stubInterface(sandbox)
    conseillerMiloRepository = stubInterface(sandbox)
    planificateurRepository = stubInterface(sandbox)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    evenementService = stubClass(EvenementService)
    dateService = stubClass(DateService)
    const idService = stubClass(IdService)
    idService.uuid.returns(idActualite)
    dateService.now.returns(date)
    dateService.nowJs.returns(date.toJSDate())

    createActualiteMiloCommandHandler = new CreateActualiteMiloCommandHandler(
      conseillerAuthorizer,
      actualiteMiloRepository,
      new ActualiteMilo.Factory(idService, dateService),
      evenementService,
      conseillerMiloRepository,
      planificateurRepository,
      dateService
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
      ).to.have.been.calledWith(idConseiller, utilisateur)
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
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(unConseillerMilo()))
      actualiteMiloRepository.save.resolves()

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(actualiteMiloRepository.save).to.have.been.calledOnce()
      const savedActualite = actualiteMiloRepository.save.firstCall.args[0]
      expect(savedActualite).to.deep.equal({
        id: idActualite,
        idStructureMilo,
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
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(unConseillerMilo()))
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
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(unConseillerMilo()))
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
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(failure(new NonTrouveError('Conseiller', idConseiller)))

      // When
      const result = await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error).to.be.instanceOf(NonTrouveError)
        expect(result.error.message).to.contain('Conseiller')
      }
    })

    it('enqueue un job de notification après création', async () => {
      // Given
      const command: CreateActualiteMiloCommand = {
        idConseiller,
        prenomNomConseiller: 'Nils Tavernier',
        titre: 'Titre',
        contenu: 'Contenu'
      }
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(unConseillerMilo()))
      actualiteMiloRepository.save.resolves()

      // When
      await createActualiteMiloCommandHandler.handle(command)

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnce()
      const jobArgs = planificateurRepository.ajouterJob.firstCall.args[0]
      expect(jobArgs.type).to.equal(
        Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO
      )
      expect(jobArgs.contenu).to.deep.equal({
        idStructureMilo,
        idActualite
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

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import AutodesinscrireBeneficiaireSessionMiloCommandHandler, {
  AutodesinscrireBeneficiaireSessionMiloCommand
} from 'src/application/commands/milo/autodesinscription-beneficiaire-session-milo.command.handler'
import {
  DroitsInsuffisants,
  NonTraitableError,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  Failure,
  isFailure,
  isSuccess,
  success
} from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { Chat } from 'src/domain/chat'
import { Core } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { JeuneMilo } from 'src/domain/milo/jeune.milo'
import { SessionMilo } from 'src/domain/milo/session.milo'
import { ChatCryptoService } from 'src/utils/chat-crypto-service'
import { DateService } from 'src/utils/date-service'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from 'test/fixtures/authentification.fixture'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { unJeune } from 'test/fixtures/jeune.fixture'
import { uneSessionMiloAllegee } from 'test/fixtures/sessions.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'

describe('AutodesinscrireBeneficiaireSessionMiloCommandHandler', () => {
  let beneficiaireMiloRepository: StubbedType<JeuneMilo.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let sessionMiloRepository: StubbedType<SessionMilo.Repository>
  let chatRepository: StubbedType<Chat.Repository>
  let chatCryptoService: StubbedClass<ChatCryptoService>
  let dateService: StubbedClass<DateService>
  let evenementService: StubbedClass<EvenementService>
  let commandHandler: AutodesinscrireBeneficiaireSessionMiloCommandHandler

  const maintenant = uneDatetime()
  const beneficiaireMilo: JeuneMilo = {
    ...unJeune(),
    idStructureMilo: 'id-structure-milo'
  }
  const utilisateurBeneficiaire = unUtilisateurJeune({
    id: beneficiaireMilo.id
  })
  const session = uneSessionMiloAllegee({
    statutInscription: SessionMilo.Inscription.Statut.INSCRIT,
    autodesinscription: true,
    dateMaxDesinscription: maintenant.plus({ days: 1 })
  })
  const command: AutodesinscrireBeneficiaireSessionMiloCommand = {
    idSession: 'id-session',
    idBeneficiaire: beneficiaireMilo.id,
    accessToken: 'accessToken',
    motif: 'Je ne peux pas venir'
  }

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    beneficiaireMiloRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    sessionMiloRepository = stubInterface(sandbox)
    chatRepository = stubInterface(sandbox)
    chatCryptoService = stubClass(ChatCryptoService)
    dateService = stubClass(DateService)
    evenementService = stubClass(EvenementService)
    commandHandler = new AutodesinscrireBeneficiaireSessionMiloCommandHandler(
      beneficiaireMiloRepository,
      authentificationRepository,
      sessionMiloRepository,
      chatRepository,
      chatCryptoService,
      dateService,
      evenementService
    )
  })

  describe('.getAggregate', () => {
    it('renvoie le bénéficiaire MILO', async () => {
      // Given
      beneficiaireMiloRepository.get
        .withArgs(beneficiaireMilo.id)
        .resolves(success(beneficiaireMilo))

      // When
      const aggregate = await commandHandler.getAggregate(command)

      // Then
      expect(aggregate).to.equal(beneficiaireMilo)
    })

    it("renvoie undefined si le bénéficiaire n'existe pas", async () => {
      // Given
      beneficiaireMiloRepository.get
        .withArgs(beneficiaireMilo.id)
        .resolves(new NonTrouveError('Jeune', beneficiaireMilo.id))

      // When
      const aggregate = await commandHandler.getAggregate(command)

      // Then
      expect(aggregate).to.be.undefined()
    })
  })

  describe('.handle', () => {
    beforeEach(async () => {
      authentificationRepository.recupererAccesPartenaire
        .withArgs('accessToken', Core.Structure.MILO)
        .resolves('token-beneficiaire-milo')
      authentificationRepository.seFairePasserPourUnConseiller
        .withArgs(beneficiaireMilo.conseiller!.id, 'accessToken')
        .resolves(success('token-conseiller-milo'))
      sessionMiloRepository.getForBeneficiaire
        .withArgs(
          'id-session',
          beneficiaireMilo.idPartenaire,
          'token-beneficiaire-milo',
          beneficiaireMilo.configuration.fuseauHoraire
        )
        .resolves(success(session))
      sessionMiloRepository.desinscrireBeneficiaire.resolves(emptySuccess())
      chatRepository.recupererConversationIndividuelle
        .withArgs(beneficiaireMilo.id)
        .resolves({ id: 'id-chat', idBeneficiaire: beneficiaireMilo.id })
      chatCryptoService.encrypt.callsFake(message => ({
        encryptedText: 'ENCRYPTED ' + message,
        iv: 'IV ' + message
      }))
      dateService.now.returns(maintenant)
    })

    it('désinscrit le bénéficiaire en se faisant passer pour le conseiller', async () => {
      // When
      await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        beneficiaireMilo
      )

      // Then
      expect(
        sessionMiloRepository.desinscrireBeneficiaire
      ).to.have.been.calledOnceWithExactly(
        'id-session',
        beneficiaireMilo.idPartenaire,
        'token-conseiller-milo'
      )
    })

    it('prévient le conseiller par chat avec le motif', async () => {
      // When
      await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        beneficiaireMilo
      )

      // Then
      expect(
        chatRepository.envoyerMessageIndividuel
      ).to.have.been.calledOnceWithExactly(
        'id-chat',
        {
          message:
            "ENCRYPTED Votre bénéficiaire a annulé sa participation à l'événement suivant",
          iv: "IV Votre bénéficiaire a annulé sa participation à l'événement suivant",
          idConseiller: '1',
          type: 'AUTO_DESINSCRIPTION',
          infoSession: {
            id: 'id-session',
            titre: 'Une session'
          },
          infoDesinscription: {
            motif: 'Je ne peux pas venir'
          }
        },
        { sentByBeneficiaire: true }
      )
    })

    it('vérifie que le bénéficiaire existe', async () => {
      // When
      const result = await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        undefined
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(NonTrouveError)
    })

    it('vérifie que le conseiller existe', async () => {
      // When
      const result = await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        { ...beneficiaireMilo, conseiller: undefined }
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(NonTraitableError)
    })

    it('vérifie que le bénéficiaire peut se désinscrire', async () => {
      // Given - session sans autodesinscription
      sessionMiloRepository.getForBeneficiaire
        .withArgs(
          'id-session',
          beneficiaireMilo.idPartenaire,
          'token-beneficiaire-milo',
          beneficiaireMilo.configuration.fuseauHoraire
        )
        .resolves(success(uneSessionMiloAllegee({ autodesinscription: false })))

      // When
      const result = await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        beneficiaireMilo
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it("ne prévient pas le conseiller si la conversation n'existe pas", async () => {
      // Given
      chatRepository.recupererConversationIndividuelle
        .withArgs(beneficiaireMilo.id)
        .resolves(undefined)

      // When
      await commandHandler.handle(
        command,
        utilisateurBeneficiaire,
        beneficiaireMilo
      )

      // Then
      expect(chatRepository.envoyerMessageIndividuel).not.to.have.been.called()
    })
  })

  describe('.authorize', () => {
    it("échoue si le bénéficiaire n'existe pas", async () => {
      // When
      const result = await commandHandler.authorize(
        command,
        utilisateurBeneficiaire,
        undefined
      )

      // Then
      expect(isFailure(result)).to.equal(true)
      expect((result as Failure).error).to.be.an.instanceOf(NonTrouveError)
    })

    it("échoue si l'utilisateur n'est pas un bénéficiaire", async () => {
      // Given
      const utilisateurConseiller = unUtilisateurConseiller({
        id: beneficiaireMilo.id
      })

      // When
      const result = await commandHandler.authorize(
        command,
        utilisateurConseiller,
        beneficiaireMilo
      )

      // Then
      expect(isFailure(result)).to.equal(true)
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it("échoue si l'utilisateur n'est pas le bénéficiaire", async () => {
      // Given
      const autreUtilisateur = unUtilisateurJeune({ id: 'un-autre-id' })

      // When
      const result = await commandHandler.authorize(
        command,
        autreUtilisateur,
        beneficiaireMilo
      )

      // Then
      expect(isFailure(result)).to.equal(true)
      expect((result as Failure).error).to.be.an.instanceOf(DroitsInsuffisants)
    })

    it("réussit si l'utilisateur est le bénéficiaire", async () => {
      // When
      const result = await commandHandler.authorize(
        command,
        utilisateurBeneficiaire,
        beneficiaireMilo
      )

      // Then
      expect(isSuccess(result)).to.equal(true)
    })
  })

  describe('.monitor', () => {
    it('envoie un événement de désinscription', async () => {
      // When
      await commandHandler.monitor(utilisateurBeneficiaire)

      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.SESSION_AUTODESINSCRIPTION,
        utilisateurBeneficiaire
      )
    })
  })
})

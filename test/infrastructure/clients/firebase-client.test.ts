import { Timestamp } from 'firebase-admin/firestore'
import { SinonStub } from 'sinon'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { MessageIndividuel } from '../../../src/domain/chat'
import { FirebaseClient } from '../../../src/infrastructure/clients/firebase-client'
import { ChatCryptoService } from '../../../src/utils/chat-crypto-service'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'

describe('FirebaseClient', () => {
  describe('envoyerMessageIndividuel', () => {
    let firebaseClient: FirebaseClient
    let updateStub: SinonStub
    let dateService: StubbedClass<DateService>

    const unMessage: MessageIndividuel = {
      message: 'bonjour',
      iv: '123',
      idConseiller: 'con-1',
      type: 'MESSAGE'
    }

    beforeEach(() => {
      const sandbox = createSandbox()
      updateStub = sandbox.stub().resolves()
      dateService = stubClass(DateService)
      dateService.now.returns(uneDatetime())

      const chatDoc = {
        get: sandbox.stub().resolves({
          data: () => ({ newConseillerMessageCount: 0 })
        }),
        update: updateStub,
        collection: sandbox.stub().returns({
          withConverter: sandbox.stub().returns({
            add: sandbox.stub().resolves()
          })
        })
      }

      firebaseClient = Object.create(FirebaseClient.prototype) as FirebaseClient
      const internals = firebaseClient as unknown as {
        logger: { log: () => void; error: () => void; warn: () => void }
        dateService: DateService
        firestore: { collection: SinonStub }
      }
      internals.logger = {
        log: (): void => {},
        error: (): void => {},
        warn: (): void => {}
      }
      internals.dateService = dateService
      internals.firestore = {
        collection: sandbox.stub().returns({
          doc: sandbox.stub().returns(chatDoc)
        })
      }
    })

    describe("quand c'est le jeune qui envoie", () => {
      it('met seenByConseiller à false pour signaler un message non lu au conseiller', async () => {
        // When
        await firebaseClient.envoyerMessageIndividuel('chat-1', unMessage, {
          sentByBeneficiaire: true
        })

        // Then
        expect(updateStub).to.have.been.calledWithMatch({
          seenByConseiller: false
        })
      })
    })

    describe("quand c'est le conseiller qui envoie", () => {
      it('ne touche pas seenByConseiller pour ne pas écraser un message non lu existant', async () => {
        // When
        await firebaseClient.envoyerMessageIndividuel('chat-1', unMessage, {
          sentByBeneficiaire: false
        })

        // Then
        const updateArgs = updateStub.getCall(0).args[0]
        expect(updateArgs).to.not.have.property('seenByConseiller')
      })
    })
  })

  describe('restaurerMessagesArchives', () => {
    let firebaseClient: FirebaseClient
    let updateStub: SinonStub
    let setStub: SinonStub
    let commitStub: SinonStub
    let messageDocStub: SinonStub
    let historiqueDocStub: SinonStub
    let getChatsStub: SinonStub
    let batchStub: SinonStub
    let chatCryptoService: StubbedClass<ChatCryptoService>

    const idJeune = 'id-jeune'
    const idConseiller = 'id-conseiller'

    beforeEach(() => {
      const sandbox = createSandbox()
      updateStub = sandbox.stub().resolves()
      setStub = sandbox.stub()
      commitStub = sandbox.stub().resolves()
      historiqueDocStub = sandbox
        .stub()
        .callsFake((id: string) => ({ id, type: 'historique' }))
      messageDocStub = sandbox.stub().callsFake((id: string) => ({
        id,
        type: 'message',
        collection: sandbox.stub().returns({ doc: historiqueDocStub })
      }))
      chatCryptoService = stubClass(ChatCryptoService)
      chatCryptoService.encrypt.returns({
        encryptedText: 'contenu-chiffré',
        iv: 'aXYtZW4tYmFzZTY0'
      })

      const chatRef = {
        collection: sandbox.stub().returns({
          withConverter: sandbox.stub().returns({ doc: messageDocStub })
        }),
        update: updateStub
      }
      getChatsStub = sandbox.stub().resolves({
        empty: false,
        docs: [{ ref: chatRef, data: (): object => ({}) }]
      })
      const whereChain = {
        where: sandbox.stub(),
        get: getChatsStub
      }
      whereChain.where.returns(whereChain)
      batchStub = sandbox.stub().returns({ set: setStub, commit: commitStub })

      firebaseClient = Object.create(FirebaseClient.prototype) as FirebaseClient
      const internals = firebaseClient as unknown as {
        logger: { log: () => void; error: () => void; warn: () => void }
        chatCryptoService: ChatCryptoService
        configService: { get: SinonStub }
        firestore: { collection: SinonStub; batch: SinonStub }
      }
      internals.logger = {
        log: (): void => {},
        error: (): void => {},
        warn: (): void => {}
      }
      internals.chatCryptoService = chatCryptoService
      internals.configService = {
        get: sandbox.stub().returns({ encryptionKey: 'une-clé-de-test' })
      }
      internals.firestore = {
        collection: sandbox.stub().returns(whereChain),
        batch: batchStub
      }
    })

    it('réinjecte les messages triés par date, rechiffrés, en rétrogradant les types à payload perdu', async () => {
      // Given
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'message avec PJ',
          date: '2023-05-02T10:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE_PJ'
        },
        {
          contenu: 'premier message',
          date: '2023-05-01T10:00:00.000Z',
          envoyePar: 'conseiller',
          type: 'MESSAGE'
        }
      ]

      // When
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then
      expect(setStub).to.have.been.calledTwice()
      expect(setStub.firstCall.args[1]).to.deep.equal({
        content: 'contenu-chiffré',
        iv: 'aXYtZW4tYmFzZTY0',
        conseillerId: idConseiller,
        sentBy: 'conseiller',
        creationDate: Timestamp.fromDate(new Date('2023-05-01T10:00:00.000Z')),
        type: 'MESSAGE'
      })
      expect(setStub.secondCall.args[1]).to.deep.include({
        sentBy: 'jeune',
        type: 'MESSAGE'
      })
      expect(updateStub).to.have.been.calledOnceWithExactly({
        lastMessageContent: 'contenu-chiffré',
        lastMessageIv: 'aXYtZW4tYmFzZTY0',
        lastMessageSentAt: Timestamp.fromDate(
          new Date('2023-05-02T10:00:00.000Z')
        ),
        lastMessageSentBy: 'jeune',
        seenByConseiller: true
      })
    })

    it('écrit en un seul batch au lieu d’un aller-retour par message', async () => {
      // Given
      const messages: ArchiveJeune.Message[] = Array.from(
        { length: 40 },
        (_, index) => ({
          contenu: `message ${index}`,
          date: `2023-05-01T10:00:${String(index).padStart(2, '0')}.000Z`,
          envoyePar: 'jeune',
          type: 'MESSAGE' as const
        })
      )

      // When
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then
      expect(setStub).to.have.callCount(40)
      expect(batchStub).to.have.been.calledOnce()
      expect(commitStub).to.have.been.calledOnce()
    })

    it('donne aux messages un id déterministe pour qu’un rejeu écrase au lieu de dupliquer', async () => {
      // Given
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'coucou',
          date: '2023-05-01T10:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE'
        }
      ]

      // When
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )
      const idPremierPassage = messageDocStub.firstCall.args[0]
      messageDocStub.resetHistory()
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then
      expect(messageDocStub.firstCall.args[0]).to.equal(idPremierPassage)
      expect(idPremierPassage).to.be.a('string')
    })

    it("ne touche pas à l'en-tête d'une conversation qui a un message plus récent (fusion)", async () => {
      // Given : le compte recréé a échangé après l'archivage
      const chatRefVivant = {
        collection: createSandbox()
          .stub()
          .returns({
            withConverter: createSandbox()
              .stub()
              .returns({ doc: messageDocStub })
          }),
        update: updateStub
      }
      getChatsStub.resolves({
        empty: false,
        docs: [
          {
            ref: chatRefVivant,
            data: (): object => ({
              lastMessageSentAt: Timestamp.fromDate(
                new Date('2026-08-01T10:00:00.000Z')
              )
            })
          }
        ]
      })
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'vieux message archivé',
          date: '2023-05-01T10:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE'
        }
      ]

      // When
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then : les messages sont réinjectés mais l'aperçu et le statut de lecture restent intacts
      expect(setStub).to.have.been.calledOnce()
      expect(updateStub).not.to.have.been.called()
    })

    it("restaure l'historique d'édition d'un message", async () => {
      // Given
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'message édité',
          date: '2023-05-01T10:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE',
          historique: [
            {
              date: '2023-05-01T09:00:00.000Z',
              contenuPrecedent: 'contenu initial'
            }
          ]
        }
      ]

      // When
      await firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then
      expect(setStub).to.have.been.calledTwice()
      const historiqueArgs = setStub.secondCall.args[1]
      expect(historiqueArgs.date).to.deep.equal(
        Timestamp.fromDate(new Date('2023-05-01T09:00:00.000Z'))
      )
      expect(historiqueArgs.previousContent).to.be.a('string')
    })

    it("échoue quand la conversation n'existe pas", async () => {
      // Given
      getChatsStub.resolves({ empty: true, docs: [] })
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'message',
          date: '2023-05-01T10:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE'
        }
      ]

      // When
      const promesse = firebaseClient.restaurerMessagesArchives(
        idJeune,
        idConseiller,
        messages
      )

      // Then
      await expect(promesse).to.be.rejectedWith(
        `Conversation du jeune ${idJeune} non trouvée`
      )
      expect(setStub).not.to.have.been.called()
    })
  })

  describe('envoyerStatutAnalysePJ', () => {
    let firebaseClient: FirebaseClient
    let getMessageStub: SinonStub
    let updateMessageStub: SinonStub
    let warnStub: SinonStub

    const idJeune = 'id-jeune'
    const idMessage = 'id-message'
    type PieceJointe = { id: string; nom: string }
    const messagePresent = {
      exists: true,
      data: (): { piecesJointes: PieceJointe[] } => ({
        piecesJointes: [{ id: 'id-pj', nom: 'cv.pdf' }]
      })
    }
    const messageAbsent = {
      exists: false,
      data: (): undefined => undefined
    }

    beforeEach(() => {
      const sandbox = createSandbox()
      getMessageStub = sandbox.stub()
      updateMessageStub = sandbox.stub().resolves()
      warnStub = sandbox.stub()

      const chatRef = {
        collection: sandbox.stub().returns({
          withConverter: sandbox.stub().returns({
            doc: sandbox
              .stub()
              .returns({ get: getMessageStub, update: updateMessageStub })
          })
        })
      }
      const whereChain = {
        where: sandbox.stub(),
        get: sandbox.stub().resolves({ empty: false, docs: [{ ref: chatRef }] })
      }
      whereChain.where.returns(whereChain)

      firebaseClient = Object.create(FirebaseClient.prototype) as FirebaseClient
      const internals = firebaseClient as unknown as {
        logger: { log: () => void; error: () => void; warn: SinonStub }
        firestore: { collection: SinonStub }
      }
      internals.logger = {
        log: (): void => {},
        error: (): void => {},
        warn: warnStub
      }
      internals.firestore = {
        collection: sandbox.stub().returns(whereChain)
      }
    })

    it("réessaie quand le message n'est pas encore écrit par l'app", async () => {
      // Given
      getMessageStub.onFirstCall().resolves(messageAbsent)
      getMessageStub.onSecondCall().resolves(messagePresent)

      // When
      await firebaseClient.envoyerStatutAnalysePJ(
        idJeune,
        idMessage,
        'analyse_en_cours',
        { attendreLeMessage: true }
      )

      // Then
      expect(getMessageStub).to.have.been.calledTwice()
      expect(updateMessageStub).to.have.been.calledOnceWithExactly({
        piecesJointes: [
          { id: 'id-pj', nom: 'cv.pdf', statut: 'analyse_en_cours' }
        ]
      })
      expect(warnStub).not.to.have.been.called()
    })

    it("n'attend pas le message pour les appels différés (jobs)", async () => {
      // Given
      getMessageStub.resolves(messageAbsent)

      // When
      await firebaseClient.envoyerStatutAnalysePJ(idJeune, idMessage, 'expiree')

      // Then
      expect(getMessageStub).to.have.been.calledOnce()
      expect(updateMessageStub).not.to.have.been.called()
    })

    it('abandonne avec un warn quand le message reste introuvable', async () => {
      // Given
      getMessageStub.resolves(messageAbsent)

      // When
      await firebaseClient.envoyerStatutAnalysePJ(idJeune, idMessage, 'valide')

      // Then
      expect(warnStub).to.have.been.calledOnceWithExactly(
        `Message ${idMessage} avec ${idJeune} non trouvé`
      )
      expect(updateMessageStub).not.to.have.been.called()
    })
  })
})

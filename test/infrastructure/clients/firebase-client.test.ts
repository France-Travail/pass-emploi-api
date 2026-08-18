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
    let addMessageStub: SinonStub
    let addHistoriqueStub: SinonStub
    let getChatsStub: SinonStub
    let chatCryptoService: StubbedClass<ChatCryptoService>

    const idJeune = 'id-jeune'
    const idConseiller = 'id-conseiller'

    beforeEach(() => {
      const sandbox = createSandbox()
      updateStub = sandbox.stub().resolves()
      addHistoriqueStub = sandbox.stub().resolves()
      addMessageStub = sandbox.stub().resolves({
        collection: sandbox.stub().returns({ add: addHistoriqueStub })
      })
      chatCryptoService = stubClass(ChatCryptoService)
      chatCryptoService.encrypt.returns({
        encryptedText: 'contenu-chiffré',
        iv: 'aXYtZW4tYmFzZTY0'
      })

      const chatRef = {
        collection: sandbox.stub().returns({
          withConverter: sandbox.stub().returns({ add: addMessageStub })
        }),
        update: updateStub
      }
      getChatsStub = sandbox
        .stub()
        .resolves({ empty: false, docs: [{ ref: chatRef }] })
      const whereChain = {
        where: sandbox.stub(),
        get: getChatsStub
      }
      whereChain.where.returns(whereChain)

      firebaseClient = Object.create(FirebaseClient.prototype) as FirebaseClient
      const internals = firebaseClient as unknown as {
        logger: { log: () => void; error: () => void; warn: () => void }
        chatCryptoService: ChatCryptoService
        configService: { get: SinonStub }
        firestore: { collection: SinonStub }
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
        collection: sandbox.stub().returns(whereChain)
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
      expect(addMessageStub).to.have.been.calledTwice()
      expect(addMessageStub.firstCall.args[0]).to.deep.equal({
        content: 'contenu-chiffré',
        iv: 'aXYtZW4tYmFzZTY0',
        conseillerId: idConseiller,
        sentBy: 'conseiller',
        creationDate: Timestamp.fromDate(new Date('2023-05-01T10:00:00.000Z')),
        type: 'MESSAGE'
      })
      expect(addMessageStub.secondCall.args[0]).to.deep.include({
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
      expect(addHistoriqueStub).to.have.been.calledOnce()
      const historiqueArgs = addHistoriqueStub.firstCall.args[0]
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
      expect(addMessageStub).not.to.have.been.called()
    })
  })
})

import { SinonStub } from 'sinon'
import { MessageIndividuel } from '../../../src/domain/chat'
import { FirebaseClient } from '../../../src/infrastructure/clients/firebase-client'
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
})

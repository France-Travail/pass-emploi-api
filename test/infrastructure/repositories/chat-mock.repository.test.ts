import axios from 'axios'
import { ConfigService } from '@nestjs/config'
import * as nock from 'nock'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { FirebaseClient } from '../../../src/infrastructure/clients/firebase-client'
import { ChatFirebaseRepository } from '../../../src/infrastructure/repositories/chat-firebase.repository'
import {
  ChatMockRepository,
  fabriquerChatRepository
} from '../../../src/infrastructure/repositories/chat-mock.repository'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('ChatMockRepository', () => {
  const chatMockUrl = 'https://mock-externes.fr/chat'
  let externalApiLogger: StubbedClass<ExternalApiLoggerService>
  let firebaseClient: StubbedClass<FirebaseClient>
  let chatRepository: ChatMockRepository

  beforeEach(() => {
    externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    firebaseClient = stubClass(FirebaseClient)
    chatRepository = new ChatMockRepository(
      firebaseClient,
      new ConfigService({ chatMockUrl }),
      externalApiLogger
    )
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it("instrumente ses appels sous le nom d'un client d'API externe", () => {
    // Then
    expect(externalApiLogger.createAxios).to.have.been.calledWith(
      'ChatMockClient'
    )
  })

  describe('recupererMessagesAArchiver', () => {
    it('renvoie les messages servis par le mock', async () => {
      // Given
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'Message 0 du chat de id-jeune',
          date: '2026-01-05T09:00:00+00:00',
          envoyePar: 'conseiller',
          type: 'MESSAGE'
        }
      ]
      nock(chatMockUrl).get('/id-jeune/messages').reply(200, messages)

      // When
      const resultat =
        await chatRepository.recupererMessagesAArchiver('id-jeune')

      // Then
      expect(resultat).to.deep.equal(messages)
      expect(firebaseClient.getChatAArchiver).not.to.have.been.called()
    })

    it('rejette quand le mock répond en erreur', async () => {
      // Given
      nock(chatMockUrl).get('/id-echec-chat/messages').reply(500)

      // When
      const promesse =
        chatRepository.recupererMessagesAArchiver('id-echec-chat')

      // Then
      await expect(promesse).to.be.rejectedWith(Error)
    })
  })

  describe('supprimerChat', () => {
    it('supprime le chat auprès du mock', async () => {
      // Given
      const scope = nock(chatMockUrl).delete('/id-jeune').reply(204)

      // When
      await chatRepository.supprimerChat('id-jeune')

      // Then
      expect(scope.isDone()).to.equal(true)
      expect(firebaseClient.supprimerChat).not.to.have.been.called()
    })

    it('rejette quand le mock répond en erreur', async () => {
      // Given
      nock(chatMockUrl).delete('/id-echec-chat').reply(500)

      // When
      const promesse = chatRepository.supprimerChat('id-echec-chat')

      // Then
      await expect(promesse).to.be.rejectedWith(Error)
    })
  })

  it('délègue le reste du chat à Firebase', async () => {
    // Given
    firebaseClient.getNombreDeConversationsNonLues.resolves(3)

    // When
    const resultat =
      await chatRepository.getNombreDeConversationsNonLues('id-conseiller')

    // Then
    expect(resultat).to.equal(3)
  })
})

describe('fabriquerChatRepository', () => {
  const firebaseClient = stubClass(FirebaseClient)
  const externalApiLogger = stubClass(ExternalApiLoggerService)

  it("fournit le faux chat quand l'URL du mock est configurée", () => {
    // When
    const chatRepository = fabriquerChatRepository(
      new ConfigService({ chatMockUrl: 'https://mock-externes.fr/chat' }),
      firebaseClient,
      externalApiLogger
    )

    // Then
    expect(chatRepository).to.be.an.instanceOf(ChatMockRepository)
  })

  it("fournit le chat Firebase quand l'URL du mock est absente", () => {
    // When
    const chatRepository = fabriquerChatRepository(
      new ConfigService({}),
      firebaseClient,
      externalApiLogger
    )

    // Then
    expect(chatRepository).to.be.an.instanceOf(ChatFirebaseRepository)
    expect(chatRepository).not.to.be.an.instanceOf(ChatMockRepository)
  })
})

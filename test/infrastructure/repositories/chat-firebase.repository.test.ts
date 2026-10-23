import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { FirebaseClient } from '../../../src/infrastructure/clients/firebase-client'
import { ChatFirebaseRepository } from '../../../src/infrastructure/repositories/chat-firebase.repository'
import { expect, stubClass } from '../../utils'

describe('ChatFirebaseRepository', () => {
  describe('recupererMessagesAArchiver', () => {
    it('renvoie les messages du chat du jeune à archiver', async () => {
      // Given
      const messages: ArchiveJeune.Message[] = [
        {
          contenu: 'Bonjour',
          date: '2026-10-01T09:00:00.000Z',
          envoyePar: 'jeune',
          type: 'MESSAGE'
        }
      ]
      const firebaseClient = stubClass(FirebaseClient)
      firebaseClient.getChatAArchiver.withArgs('id-jeune').resolves(messages)
      const chatRepository = new ChatFirebaseRepository(firebaseClient)

      // When
      const resultat =
        await chatRepository.recupererMessagesAArchiver('id-jeune')

      // Then
      expect(resultat).to.deep.equal(messages)
    })
  })
})

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosInstance } from 'axios'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Chat } from '../../domain/chat'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { FirebaseClient } from '../clients/firebase-client'
import { ChatFirebaseRepository } from './chat-firebase.repository'

@Injectable()
export class ChatMockRepository extends ChatFirebaseRepository {
  private readonly axios: AxiosInstance
  private readonly chatMockUrl: string

  constructor(
    firebaseClient: FirebaseClient,
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super(firebaseClient)
    this.axios = externalApiLogger.createAxios('ChatMockClient')
    this.chatMockUrl = configService.get('chatMockUrl')!
  }

  async recupererMessagesAArchiver(
    idJeune: string
  ): Promise<ArchiveJeune.Message[]> {
    const reponse = await this.axios.get<ArchiveJeune.Message[]>(
      `${this.chatMockUrl}/${encodeURIComponent(idJeune)}/messages`
    )
    return reponse.data
  }

  async supprimerChat(idJeune: string): Promise<void> {
    await this.axios.delete(
      `${this.chatMockUrl}/${encodeURIComponent(idJeune)}`
    )
  }
}

export function fabriquerChatRepository(
  configService: ConfigService,
  firebaseClient: FirebaseClient,
  externalApiLogger: ExternalApiLoggerService
): Chat.Repository {
  if (configService.get('chatMockUrl')) {
    return new ChatMockRepository(
      firebaseClient,
      configService,
      externalApiLogger
    )
  }
  return new ChatFirebaseRepository(firebaseClient)
}

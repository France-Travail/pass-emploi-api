import { Injectable } from '@nestjs/common'
import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import { ChatSecretsQueryModel } from './query-models/authentification.query-model'
import { FirebaseClient } from '../../infrastructure/clients/firebase-client'
import { ConfigService } from '@nestjs/config'
import { emptySuccess, Result } from '../../building-blocks/types/result'

export interface GetChatSecretsQuery extends Query {
  utilisateur: Authentification.Utilisateur
}

@Injectable()
export class GetChatSecretsQueryHandler extends QueryHandler<
  GetChatSecretsQuery,
  ChatSecretsQueryModel | undefined
> {
  readonly profilsAutorises = [
    Profil.MILO,
    Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.FT_DEMANDEUR_EMPLOI,
    Profil.CONSEIL_DEPT
  ]

  constructor(
    private firebaseClient: FirebaseClient,
    private configService: ConfigService
  ) {
    super('GetChatSecretsQueryHandler')
  }

  async handle(
    query: GetChatSecretsQuery
  ): Promise<ChatSecretsQueryModel | undefined> {
    const firebaseToken = await this.firebaseClient.getToken(query.utilisateur)
    const encryptionKey = this.configService.get('firebase').encryptionKey

    return firebaseToken && encryptionKey
      ? {
          token: firebaseToken,
          cle: encryptionKey
        }
      : undefined
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

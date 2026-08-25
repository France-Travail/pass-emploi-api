import { Inject, Injectable } from '@nestjs/common'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  Result,
  emptySuccess,
  failure,
  success
} from '../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import { Core } from '../../domain/core'
import {
  memeProfil,
  structureLegacyVersProfil,
  TOUT_PROFIL
} from '../../domain/profil'
import {
  UtilisateurQueryModel,
  queryModelFromUtilisateur
} from './query-models/authentification.query-model'

export interface GetUtilisateurQuery extends Query {
  idAuthentification: string
  typeUtilisateur: Authentification.Type
  // Format d'entrée de connect (rétro-compat) : structure legacy.
  structureUtilisateur: Core.Structure
}

@Injectable()
export class GetUtilisateurQueryHandler extends QueryHandler<
  GetUtilisateurQuery,
  Result<UtilisateurQueryModel>
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository
  ) {
    super('GetUtilisateurQueryHandler')
  }

  async handle(
    query: GetUtilisateurQuery
  ): Promise<Result<UtilisateurQueryModel>> {
    const profilAttendu = structureLegacyVersProfil(query.structureUtilisateur)
    let utilisateur = undefined

    switch (query.typeUtilisateur) {
      case Authentification.Type.JEUNE: {
        utilisateur = await this.authentificationRepository.getJeuneByProfil(
          query.idAuthentification,
          profilAttendu
        )
        break
      }
      case Authentification.Type.CONSEILLER: {
        utilisateur = await this.authentificationRepository.getConseiller(
          query.idAuthentification
        )
        if (utilisateur && !memeProfil(profilAttendu, utilisateur.profil)) {
          utilisateur = undefined
        }
        break
      }
    }

    if (!utilisateur) {
      return failure(
        new NonTrouveError('Utilisateur', query.idAuthentification)
      )
    }

    return success(queryModelFromUtilisateur(utilisateur))
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

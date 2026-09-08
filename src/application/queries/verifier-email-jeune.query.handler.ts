import { Inject, Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  Result,
  emptySuccess,
  failure,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_PROFIL } from '../../domain/profil'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'

export interface VerifierEmailJeuneQuery extends Query {
  email: string
}

export interface EmailJeuneQueryModel {
  emailExistant: boolean
}

@Injectable()
export class VerifierEmailJeuneQueryHandler extends QueryHandler<
  VerifierEmailJeuneQuery,
  Result<EmailJeuneQueryModel>
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository
  ) {
    super('VerifierEmailJeuneQueryHandler')
  }

  async handle(
    query: VerifierEmailJeuneQuery
  ): Promise<Result<EmailJeuneQueryModel>> {
    const beneficiaire = await this.jeuneRepository.getByEmail(query.email)

    return success({
      emailExistant: Boolean(beneficiaire)
    })
  }

  async authorize(
    _query: VerifierEmailJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!Authentification.estConseiller(utilisateur.type)) {
      return failure(new DroitsInsuffisants())
    }
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

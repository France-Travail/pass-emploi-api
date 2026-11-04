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
import { PROFILS_FT_CONNECT } from '../../domain/profil'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'

export interface VerifierAccompagnementBeneficiaireQuery extends Query {
  email: string
}

export interface AccompagnementBeneficiaireQueryModel {
  dejaAccompagne: boolean
}

@Injectable()
export class VerifierAccompagnementBeneficiaireQueryHandler extends QueryHandler<
  VerifierAccompagnementBeneficiaireQuery,
  Result<AccompagnementBeneficiaireQueryModel>
> {
  readonly profilsAutorises = PROFILS_FT_CONNECT

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository
  ) {
    super('VerifierAccompagnementBeneficiaireQueryHandler')
  }

  async handle(
    query: VerifierAccompagnementBeneficiaireQuery
  ): Promise<Result<AccompagnementBeneficiaireQueryModel>> {
    const beneficiaire = await this.jeuneRepository.getByEmail(query.email, {
      includeConseiller: true
    })

    return success({
      dejaAccompagne:
        beneficiaire !== undefined && Jeune.estAccompagne(beneficiaire)
    })
  }

  async authorize(
    _query: VerifierAccompagnementBeneficiaireQuery,
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

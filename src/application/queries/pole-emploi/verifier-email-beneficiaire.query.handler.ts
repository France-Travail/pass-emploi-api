import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../../building-blocks/types/query'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import { Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { beneficiaireEstFTConnect } from '../../../domain/core'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'

export interface VerifierEmailBeneficiaireFTQuery extends Query {
  email: string
}

export interface EmailBeneficiaireFTQueryModel {
  emailExistant: boolean
}

@Injectable()
export class VerifierEmailBeneficiaireQueryHandler extends QueryHandler<
  VerifierEmailBeneficiaireFTQuery,
  Result<EmailBeneficiaireFTQueryModel>
> {
  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('VerifierEmailBeneficiaireQueryHandler')
  }

  async handle(
    query: VerifierEmailBeneficiaireFTQuery
  ): Promise<Result<EmailBeneficiaireFTQueryModel>> {
    const beneficiaire = await this.jeuneRepository.getByEmail(query.email)

    return success({
      emailExistant: Boolean(beneficiaire)
    })
  }

  async authorize(
    _query: VerifierEmailBeneficiaireFTQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseillerPourTous(
      utilisateur,
      beneficiaireEstFTConnect(utilisateur.structure)
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

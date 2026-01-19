import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../../building-blocks/types/query'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { estFranceTravail } from '../../../domain/core'
import { DroitsInsuffisants } from '../../../building-blocks/types/domain-error'

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
    const lowerCaseEmail = query.email.trim().toLocaleLowerCase()
    const beneficiaire = await this.jeuneRepository.getByEmail(lowerCaseEmail)

    if (!beneficiaire) {
      return success({
        emailExistant: false
      })
    } else if (estFranceTravail(beneficiaire.structure)) {
      return success({
        emailExistant: true
      })
    }

    return failure(new DroitsInsuffisants())
  }

  async authorize(
    _query: VerifierEmailBeneficiaireFTQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseillerPourTous(
      utilisateur,
      estFranceTravail(utilisateur.structure)
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

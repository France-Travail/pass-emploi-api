import { Inject, Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../../building-blocks/types/domain-error'
import { Query } from '../../../building-blocks/types/query'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import {
  Result,
  emptySuccess,
  failure,
  success
} from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { TOUT_FRANCE_TRAVAIL } from '../../../domain/profil'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'

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
  readonly profilsAutorises = TOUT_FRANCE_TRAVAIL

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository
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

  // Aucune appartenance de ressource à vérifier : tout conseiller FT peut
  // interroger n'importe quel email. Le profil garantit FT ; le type
  // (conseiller, pas jeune) relève de ce contrôle.
  async authorize(
    _query: VerifierEmailBeneficiaireFTQuery,
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

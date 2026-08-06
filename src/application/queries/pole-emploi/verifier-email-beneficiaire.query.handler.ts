import { Inject, Injectable } from '@nestjs/common'
import { Query } from '../../../building-blocks/types/query'
import { QueryHandler } from '../../../building-blocks/types/query-handler'
import {
  Result,
  emptySuccess,
  success
} from '../../../building-blocks/types/result'
import { Profil } from '../../../domain/profil'
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
  readonly profilsAutorises = [Profil.Conseiller.FT]

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
  // interroger n'importe quel email. `autoriserLeConseillerPourTous`
  // (supprimée) ne faisait que redire le profil déjà garanti ci-dessus.
  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

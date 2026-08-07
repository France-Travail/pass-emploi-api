import { Inject, Injectable } from '@nestjs/common'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import {
  Result,
  failure,
  isFailure,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import { Profil } from '../../domain/profil'
import { DocumentPoleEmploiDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import {
  PoleEmploiPartenaireClient,
  PoleEmploiPartenaireClientToken
} from '../../infrastructure/clients/pole-emploi-partenaire-client.db'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { CVPoleEmploiQueryModel } from './query-models/jeunes.pole-emploi.query-model'

export interface GetCVPoleEmploiQuery extends Query {
  idJeune: string
  accessToken: string
}

@Injectable()
export class GetCVPoleEmploiQueryHandler extends QueryHandler<
  GetCVPoleEmploiQuery,
  Result<CVPoleEmploiQueryModel[]>
> {
  readonly profilsAutorises = [
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    Profil.Jeune.CONSEIL_DEPT
  ]

  constructor(
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    @Inject(PoleEmploiPartenaireClientToken)
    private poleEmploiPartenaireClient: PoleEmploiPartenaireClient,
    private oidcClient: OidcClient,
    private jeuneAuthorizer: JeuneAuthorizer
  ) {
    super('GetCVPoleEmploiQueryHandler')
  }
  async authorize(
    query: GetCVPoleEmploiQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async handle(
    query: GetCVPoleEmploiQuery
  ): Promise<Result<CVPoleEmploiQueryModel[]>> {
    const jeune = await this.jeuneRepository.get(query.idJeune)
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', query.idJeune))
    }
    const idpToken = await this.oidcClient.exchangeTokenJeune(
      query.accessToken,
      jeune.structure
    )

    const documentsPoleEmploiDto: Result<DocumentPoleEmploiDto[]> =
      await this.poleEmploiPartenaireClient.getDocuments(idpToken)

    if (isFailure(documentsPoleEmploiDto)) {
      return documentsPoleEmploiDto
    }

    const cvPoleEmploiQueryModel: CVPoleEmploiQueryModel[] =
      documentsPoleEmploiDto.data
        .filter(estUnCVPoleEmploi)
        .map(fromCVDtoToCVQueryModel)
    return success(cvPoleEmploiQueryModel)
  }

  async monitor(): Promise<void> {
    return
  }
}

function estUnCVPoleEmploi(documentDto: DocumentPoleEmploiDto): boolean {
  return documentDto.type.code === 'CV'
}

function fromCVDtoToCVQueryModel(
  cvDto: DocumentPoleEmploiDto
): CVPoleEmploiQueryModel {
  return {
    nomFichier: cvDto.nomFichier,
    titre: cvDto.titre,
    url: cvDto.url
  }
}

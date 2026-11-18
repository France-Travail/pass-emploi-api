import { Injectable } from '@nestjs/common'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import {
  Failure,
  failure,
  isFailure,
  Result,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Commune } from '../../domain/commune'
import { TOUT_INVITE } from '../../domain/profil'
import { ApprentissageClient } from '../../infrastructure/clients/apprentissage-client'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { isDefined } from '../../utils/is-defined'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import {
  toStructureAccompagnementFT,
  toStructureAccompagnementMilo
} from './query-mappers/structures-accompagnement.mappers'
import {
  StructureAccompagnementQueryModel,
  TypeStructureAccompagnement
} from './query-models/structures-accompagnement.query-model'

export interface GetStructuresAccompagnementQuery extends Query {
  type: TypeStructureAccompagnement
  codeInsee: string
  codePostal: string
}

@Injectable()
export class GetStructuresAccompagnementQueryHandler extends QueryHandler<
  GetStructuresAccompagnementQuery,
  Result<StructureAccompagnementQueryModel[]>
> {
  readonly profilsAutorises = TOUT_INVITE

  constructor(
    private readonly apprentissageClient: ApprentissageClient,
    private readonly poleEmploiClient: PoleEmploiClient,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer
  ) {
    super('GetStructuresAccompagnementQueryHandler')
  }

  async handle(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    return query.type === TypeStructureAccompagnement.MILO
      ? this.recupererMissionLocale(query)
      : this.recupererAgencesFT(query)
  }

  async authorize(
    _query: GetStructuresAccompagnementQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneInviteAuthorizer.autoriserLInvite(
      utilisateur.id,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }

  private async recupererAgencesFT(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    const codeCommune = Commune.codeInseeArrondissement(
      query.codeInsee,
      query.codePostal
    )
    if (!codeCommune) return success([])

    const result =
      await this.poleEmploiClient.getAgencesFTParCommune(codeCommune)
    if (isFailure(result)) return masquerRefusPartenaire(result)

    return success(
      result.data.map(toStructureAccompagnementFT).filter(isDefined)
    )
  }

  private async recupererMissionLocale(
    query: GetStructuresAccompagnementQuery
  ): Promise<Result<StructureAccompagnementQueryModel[]>> {
    const result = await this.apprentissageClient.rechercherCommunes(
      query.codePostal
    )
    if (isFailure(result)) return masquerRefusPartenaire(result)

    const missionLocale = result.data.find(
      commune => commune.code.insee === query.codeInsee
    )?.mission_locale
    if (!missionLocale) return success([])

    const structure = toStructureAccompagnementMilo(missionLocale)
    return success(structure ? [structure] : [])
  }
}

const STATUTS_REFUS_PARTENAIRE = new Set([401, 403])

function masquerRefusPartenaire(echec: Failure): Failure {
  const erreur = echec.error
  if (
    erreur instanceof ErreurHttp &&
    STATUTS_REFUS_PARTENAIRE.has(erreur.statusCode)
  ) {
    return failure(new ErreurHttp(erreur.message, 502))
  }
  return echec
}

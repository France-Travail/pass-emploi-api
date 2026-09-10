import { Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Op } from 'sequelize'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUT_FRANCE_TRAVAIL } from '../../domain/profil'
import { JeuneSqlModel } from '../../infrastructure/sequelize/models/jeune.sql-model'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'

export class ImpactChangementDispositifQueryModel {
  @ApiProperty({
    description:
      'Bénéficiaires qui suivront le nouveau dispositif : suivis en propre, ou transférés temporairement à un autre conseiller'
  })
  nbBeneficiairesConcernes: number

  @ApiProperty({
    description:
      'Parmi les concernés, ceux actuellement suivis à titre temporaire par un autre conseiller'
  })
  nbBeneficiairesTransferesTemporairement: number

  @ApiProperty({
    description:
      'Bénéficiaires suivis temporairement pour un autre conseiller : ils gardent le dispositif de ce conseiller'
  })
  nbBeneficiairesSuivisTemporairement: number
}

export interface GetImpactChangementDispositifQuery extends Query {
  idConseiller: string
}

@Injectable()
export class GetImpactChangementDispositifQueryHandler extends QueryHandler<
  GetImpactChangementDispositifQuery,
  Result<ImpactChangementDispositifQueryModel>
> {
  readonly profilsAutorises = TOUT_FRANCE_TRAVAIL

  constructor(private readonly conseillerAuthorizer: ConseillerAuthorizer) {
    super('GetImpactChangementDispositifQueryHandler')
  }

  async handle(
    query: GetImpactChangementDispositifQuery
  ): Promise<Result<ImpactChangementDispositifQueryModel>> {
    const [
      nbBeneficiairesSuivisEnPropre,
      nbBeneficiairesTransferesTemporairement,
      nbBeneficiairesSuivisTemporairement
    ] = await Promise.all([
      JeuneSqlModel.count({
        where: { idConseiller: query.idConseiller, idConseillerInitial: null }
      }),
      JeuneSqlModel.count({
        where: { idConseillerInitial: query.idConseiller }
      }),
      JeuneSqlModel.count({
        where: {
          idConseiller: query.idConseiller,
          idConseillerInitial: { [Op.ne]: null }
        }
      })
    ])

    return success({
      nbBeneficiairesConcernes:
        nbBeneficiairesSuivisEnPropre + nbBeneficiairesTransferesTemporairement,
      nbBeneficiairesTransferesTemporairement,
      nbBeneficiairesSuivisTemporairement
    })
  }

  async authorize(
    query: GetImpactChangementDispositifQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      query.idConseiller,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

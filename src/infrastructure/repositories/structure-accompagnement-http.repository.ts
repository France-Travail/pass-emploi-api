import { Injectable } from '@nestjs/common'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import {
  Failure,
  failure,
  isFailure,
  Result,
  success
} from '../../building-blocks/types/result'
import { StructureAccompagnement } from '../../domain/structure-accompagnement'
import { isDefined } from '../../utils/is-defined'
import { ApprentissageClient } from '../clients/apprentissage-client'
import { PoleEmploiClient } from '../clients/pole-emploi-client'
import { Commune } from './mappers/commune.mappers'
import {
  toStructureAccompagnementFT,
  toStructureAccompagnementMilo
} from './mappers/structures-accompagnement.mappers'

@Injectable()
export class StructureAccompagnementHttpRepository
  implements StructureAccompagnement.Repository
{
  constructor(
    private readonly apprentissageClient: ApprentissageClient,
    private readonly poleEmploiClient: PoleEmploiClient
  ) {}

  async findAllAgencesFranceTravail(
    codeInsee: string,
    codePostal: string
  ): Promise<Result<StructureAccompagnement[]>> {
    const codeCommune = Commune.codeInseeArrondissement(codeInsee, codePostal)
    if (!codeCommune) return success([])

    const result =
      await this.poleEmploiClient.getAgencesFTParCommune(codeCommune)
    if (isFailure(result)) return masquerRefusPartenaire(result)

    return success(
      result.data.map(toStructureAccompagnementFT).filter(isDefined)
    )
  }

  async findMissionLocale(
    codeInsee: string,
    codePostal: string
  ): Promise<Result<StructureAccompagnement | undefined>> {
    const result = await this.apprentissageClient.rechercherCommunes(codePostal)
    if (isFailure(result)) return masquerRefusPartenaire(result)

    const missionLocale = result.data.find(
      commune => commune.code.insee === codeInsee
    )?.mission_locale
    if (!missionLocale) return success(undefined)

    return success(toStructureAccompagnementMilo(missionLocale))
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

import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import { aEteInscrit } from 'src/infrastructure/clients/dto/milo.dto'
import { SessionsMiloFetcher } from './sessions-milo.fetcher'
import { Authentification } from '../../../../domain/authentification'
import JeuneOuConseiller = Authentification.JeuneOuConseiller

@Injectable()
export class GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter {
  constructor(private readonly fetcher: SessionsMiloFetcher) {}

  async handle(
    idJeune: string,
    utilisateur: JeuneOuConseiller,
    accessToken: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionJeuneMiloQueryModel[]>> {
    const result = await this.fetcher.fetch(
      idJeune,
      utilisateur,
      accessToken,
      periode
    )

    if (result === null) return success([])
    if (isFailure(result)) return result

    const {
      beneficiaire,
      timezoneDeLaStructureDuJeune,
      sessionsDuJeuneVenantDeLAPI,
      configurationsSessions,
      maintenant
    } = result.data

    const sessionsInscrites = sessionsDuJeuneVenantDeLAPI.filter(
      ({ sessionInstance }) => aEteInscrit(sessionInstance)
    )

    return success(
      this.fetcher.mapAndSort(
        sessionsInscrites,
        beneficiaire,
        timezoneDeLaStructureDuJeune,
        configurationsSessions,
        maintenant
      )
    )
  }
}

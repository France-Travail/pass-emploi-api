import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import {
  aEteInscrit,
  SessionParDossierJeuneDto
} from 'src/infrastructure/clients/dto/milo.dto'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { SessionsMiloFetcher } from './sessions-milo.fetcher'

@Injectable()
export class GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter {
  constructor(
    private readonly oidcClient: OidcClient,
    private readonly miloClient: MiloClient,
    private readonly fetcher: SessionsMiloFetcher
  ) {}

  async handle(
    idJeune: string,
    accessToken: string,
    options?: {
      periode?: { debut?: DateTime; fin?: DateTime }
    }
  ): Promise<Result<SessionJeuneMiloQueryModel[]>> {
    const result = await this.fetcher.fetch(idJeune, idPartenaire =>
      this.getSessionsJeunePourConseiller(
        accessToken,
        idPartenaire,
        options?.periode
      )
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

  private async getSessionsJeunePourConseiller(
    accessToken: string,
    idPartenaire: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    const idpToken =
      await this.oidcClient.exchangeTokenConseillerMilo(accessToken)

    return this.miloClient.getSessionsParDossierJeunePourConseiller(
      idpToken,
      idPartenaire,
      periode
    )
  }
}

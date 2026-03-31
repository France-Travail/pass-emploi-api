import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import {
  aEteInscrit,
  SessionParDossierJeuneDto
} from 'src/infrastructure/clients/dto/milo.dto'
import { SessionsMiloFetcher } from './sessions-milo.fetcher'
import { DateService } from '../../../../utils/date-service'
import { Authentification } from '../../../../domain/authentification'
import JeuneOuConseiller = Authentification.JeuneOuConseiller

@Injectable()
export class GetSessionsVisiblesPourLeJeuneMiloQueryGetter {
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

    const idsSessionsVisibles = new Set(
      configurationsSessions
        .filter(({ estVisible }) => estVisible)
        .map(({ id }) => id)
    )
    const sessionsVisiblesNonExpirees = sessionsDuJeuneVenantDeLAPI.filter(
      session => {
        if (!idsSessionsVisibles.has(session.session.id.toString()))
          return false
        const dateMaxInscription = session.session.dateMaxInscription
        if (!dateMaxInscription) return true

        const dateMax = DateService.dateStringToEndOfDayUtc(
          dateMaxInscription,
          timezoneDeLaStructureDuJeune
        )
        return maintenant <= dateMax
      }
    )

    const sessionsDuJeune = concatSessionsSansDoublon(
      sessionsInscrites,
      sessionsVisiblesNonExpirees
    )

    return success(
      this.fetcher.mapAndSort(
        sessionsDuJeune,
        beneficiaire,
        timezoneDeLaStructureDuJeune,
        configurationsSessions,
        maintenant
      )
    )
  }
}

function concatSessionsSansDoublon(
  sessionsInscrites: SessionParDossierJeuneDto[],
  sessionsVisibles: SessionParDossierJeuneDto[]
): SessionParDossierJeuneDto[] {
  const sessions = [...sessionsInscrites]
  const idsInscrits = new Set(
    sessionsInscrites.map(({ session }) => session.id)
  )
  sessionsVisibles.forEach(sessionVisible => {
    if (!idsInscrits.has(sessionVisible.session.id)) {
      sessions.push(sessionVisible)
    }
  })
  return sessions
}

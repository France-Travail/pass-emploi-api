import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { dtoToSessionMiloBeneficiaireDetaillee } from 'src/application/queries/query-mappers/milo.mappers'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import {
  SessionMilo,
  SessionMiloBeneficiaireDetaillee
} from 'src/domain/milo/session.milo'
import { SessionsMiloFetcher } from './sessions-milo.fetcher'
import { Authentification } from '../../../../domain/authentification'
import JeuneOuConseiller = Authentification.JeuneOuConseiller

@Injectable()
export class GetSessionsVisiblesOuInscritesPourLeJeuneMiloQueryGetter {
  constructor(private readonly fetcher: SessionsMiloFetcher) {}

  async handle(
    idJeune: string,
    utilisateur: JeuneOuConseiller,
    accessToken: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionMiloBeneficiaireDetaillee[]>> {
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
      configurationsSessions
    } = result.data

    const idsSessionsVisibles = new Set(
      configurationsSessions
        .filter(({ estVisible }) => estVisible)
        .map(({ id }) => id)
    )

    const sessions = sessionsDuJeuneVenantDeLAPI
      .map(sessionDto =>
        dtoToSessionMiloBeneficiaireDetaillee(
          sessionDto,
          configurationsSessions.find(
            ({ id }) => id === sessionDto.session.id.toString()
          ),
          beneficiaire.idPartenaire!,
          timezoneDeLaStructureDuJeune
        )
      )
      .filter(
        session =>
          SessionMilo.Inscription.aEteInscrit(session.statutInscription) ||
          idsSessionsVisibles.has(session.id)
      )
      .sort((s1, s2) => s1.debut.toMillis() - s2.debut.toMillis())

    return success(sessions)
  }
}

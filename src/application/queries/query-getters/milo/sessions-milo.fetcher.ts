import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { mapSessionJeuneDtoToQueryModel } from 'src/application/queries/query-mappers/milo.mappers'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import { SessionParDossierJeuneDto } from 'src/infrastructure/clients/dto/milo.dto'
import { SessionMiloSqlModel } from 'src/infrastructure/sequelize/models/session-milo.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { JeuneSqlModel } from '../../../../infrastructure/sequelize/models/jeune.sql-model'
import { DateService } from '../../../../utils/date-service'
import { OidcClient } from '../../../../infrastructure/clients/oidc-client.db'
import { MiloClient } from '../../../../infrastructure/clients/milo/milo-client'
import { Authentification } from '../../../../domain/authentification'
import JeuneOuConseiller = Authentification.JeuneOuConseiller
import Type = Authentification.Type
import { Profil } from '../../../../domain/profil'

export interface SessionsFetchResult {
  beneficiaire: JeuneSqlModel
  timezoneDeLaStructureDuJeune: string
  sessionsDuJeuneVenantDeLAPI: SessionParDossierJeuneDto[]
  configurationsSessions: SessionMiloSqlModel[]
  maintenant: DateTime
}

@Injectable()
export class SessionsMiloFetcher {
  constructor(
    private readonly dateService: DateService,
    private readonly oidcClient: OidcClient,
    private readonly miloClient: MiloClient
  ) {}

  async fetch(
    idJeune: string,
    utilisateur: JeuneOuConseiller,
    accessToken: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionsFetchResult> | null> {
    const beneficiaire = await JeuneSqlModel.findByPk(idJeune, {
      include: [{ model: StructureMiloSqlModel, required: true }]
    })
    if (!beneficiaire?.idPartenaire || !beneficiaire.structureMilo) return null

    const resultSessionMiloClient = await this.getSessions(
      utilisateur,
      accessToken,
      beneficiaire.idPartenaire,
      periode
    )

    if (isFailure(resultSessionMiloClient)) {
      return resultSessionMiloClient
    }

    const sessionsDuJeuneVenantDeLAPI = resultSessionMiloClient.data

    const configurationsSessions = await SessionMiloSqlModel.findAll({
      where: {
        id: sessionsDuJeuneVenantDeLAPI.map(({ session }) =>
          session.id.toString()
        )
      }
    })

    return success({
      beneficiaire,
      timezoneDeLaStructureDuJeune: beneficiaire.structureMilo.timezone,
      sessionsDuJeuneVenantDeLAPI,
      configurationsSessions,
      maintenant: this.dateService.now()
    })
  }

  private async getSessions(
    utilisateur: JeuneOuConseiller,
    accessToken: string,
    idPartenaire: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    switch (utilisateur) {
      case Type.JEUNE: {
        const idpToken = await this.oidcClient.exchangeToken(
          accessToken,
          Profil.Structure.MILO
        )
        return this.miloClient.getSessionsParDossierJeune(
          idpToken,
          idPartenaire,
          periode
        )
      }
      case Authentification.Type.CONSEILLER: {
        const idpToken = await this.oidcClient.exchangeToken(
          accessToken,
          Profil.Structure.MILO
        )
        return this.miloClient.getSessionsParDossierJeunePourConseiller(
          idpToken,
          idPartenaire,
          periode
        )
      }
    }
  }

  mapAndSort(
    sessions: SessionParDossierJeuneDto[],
    beneficiaire: JeuneSqlModel,
    timezone: string,
    configurationsSessions: SessionMiloSqlModel[],
    maintenant: DateTime
  ): SessionJeuneMiloQueryModel[] {
    return sessions
      .map(sessionDuJeune => {
        const sqlModel = configurationsSessions.find(
          ({ id }) => id === sessionDuJeune.session.id.toString()
        )
        return mapSessionJeuneDtoToQueryModel(
          sessionDuJeune,
          beneficiaire.idPartenaire!,
          timezone,
          maintenant,
          sqlModel
            ? {
                autoinscription: sqlModel.autoinscription,
                autodesinscription: sqlModel.autodesinscription
              }
            : undefined
        )
      })
      .sort(compareSessionsByDebut)
  }
}

function compareSessionsByDebut(
  session1: SessionJeuneMiloQueryModel,
  session2: SessionJeuneMiloQueryModel
): number {
  const date1 = DateTime.fromISO(session1.dateHeureDebut)
  const date2 = DateTime.fromISO(session2.dateHeureDebut)
  return date1.toMillis() - date2.toMillis()
}

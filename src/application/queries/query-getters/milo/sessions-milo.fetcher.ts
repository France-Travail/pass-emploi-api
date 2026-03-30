import { Injectable, Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { mapSessionJeuneDtoToQueryModel } from 'src/application/queries/query-mappers/milo.mappers'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import { SessionParDossierJeuneDto } from 'src/infrastructure/clients/dto/milo.dto'
import { SessionMiloSqlModel } from 'src/infrastructure/sequelize/models/session-milo.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { JeuneSqlModel } from '../../../../infrastructure/sequelize/models/jeune.sql-model'
import { DateService } from '../../../../utils/date-service'

export interface SessionsFetchResult {
  beneficiaire: JeuneSqlModel
  timezoneDeLaStructureDuJeune: string
  sessionsDuJeuneVenantDeLAPI: SessionParDossierJeuneDto[]
  configurationsSessions: SessionMiloSqlModel[]
  maintenant: DateTime
}

@Injectable()
export class SessionsMiloFetcher {
  private readonly logger: Logger

  constructor(private readonly dateService: DateService) {
    this.logger = new Logger('SessionsMiloFetcher')
  }

  async fetch(
    idJeune: string,
    apiCall: (
      idPartenaire: string
    ) => Promise<Result<SessionParDossierJeuneDto[]>>
  ): Promise<Result<SessionsFetchResult> | null> {
    const beneficiaire = await JeuneSqlModel.findByPk(idJeune, {
      include: [{ model: StructureMiloSqlModel, required: true }]
    })
    if (!beneficiaire?.idPartenaire || !beneficiaire.structureMilo) return null

    const resultSessionMiloClient = await apiCall(beneficiaire.idPartenaire)

    if (isFailure(resultSessionMiloClient)) {
      this.logger.log(
        `Sessions venant de l'API en erreur : ${resultSessionMiloClient.error}`
      )
      return resultSessionMiloClient
    }

    const sessionsDuJeuneVenantDeLAPI = resultSessionMiloClient.data
    this.logger.log(
      `${sessionsDuJeuneVenantDeLAPI.length} Sessions venant de l'API`
    )

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

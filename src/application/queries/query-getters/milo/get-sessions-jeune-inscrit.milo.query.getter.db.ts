import { Injectable, Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { mapSessionJeuneDtoToQueryModel } from 'src/application/queries/query-mappers/milo.mappers'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import {
  aEteInscrit,
  SessionParDossierJeuneDto
} from 'src/infrastructure/clients/dto/milo.dto'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { SessionMiloSqlModel } from 'src/infrastructure/sequelize/models/session-milo.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { JeuneSqlModel } from '../../../../infrastructure/sequelize/models/jeune.sql-model'
import { DateService } from '../../../../utils/date-service'

@Injectable()
export class GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter {
  private readonly logger: Logger

  constructor(
    private readonly oidcClient: OidcClient,
    private readonly miloClient: MiloClient,
    private readonly dateService: DateService
  ) {
    this.logger = new Logger(
      'GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter'
    )
  }

  async handle(
    idJeune: string,
    accessToken: string,
    options?: {
      periode?: { debut?: DateTime; fin?: DateTime }
    }
  ): Promise<Result<SessionJeuneMiloQueryModel[]>> {
    const beneficiaire = await JeuneSqlModel.findByPk(idJeune, {
      include: [{ model: StructureMiloSqlModel, required: true }]
    })
    if (!beneficiaire?.idPartenaire || !beneficiaire.structureMilo)
      return success([])
    const timezoneDeLaStructureDuJeune = beneficiaire.structureMilo.timezone

    const sessionGetter = this.getSessionsJeunePourConseiller.bind(this)
    const resultSessionMiloClient = await sessionGetter(
      accessToken,
      beneficiaire.idPartenaire,
      options?.periode
    )

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

    const maintenant = this.dateService.now()

    return success(
      recupererSessionsAuxquellesLeJeuneEstInscrit(sessionsDuJeuneVenantDeLAPI)
        .map(sessionDuJeune => {
          const sqlModel = configurationsSessions.find(
            ({ id }) => id === sessionDuJeune.session.id.toString()
          )
          return mapSessionJeuneDtoToQueryModel(
            sessionDuJeune,
            beneficiaire.idPartenaire!,
            timezoneDeLaStructureDuJeune,
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

function recupererSessionsAuxquellesLeJeuneEstInscrit(
  sessions: SessionParDossierJeuneDto[]
): SessionParDossierJeuneDto[] {
  return sessions.filter(({ sessionInstance }) => aEteInscrit(sessionInstance))
}

function compareSessionsByDebut(
  session1: SessionJeuneMiloQueryModel,
  session2: SessionJeuneMiloQueryModel
): number {
  const date1 = DateTime.fromISO(session1.dateHeureDebut)
  const date2 = DateTime.fromISO(session2.dateHeureDebut)
  return date1.toMillis() - date2.toMillis()
}

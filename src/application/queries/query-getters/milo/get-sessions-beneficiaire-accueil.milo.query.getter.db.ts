import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import {
  buildSessionTypeQueryModel,
  dtoToStatutInscription
} from 'src/application/queries/query-mappers/milo.mappers'
import { SessionJeuneMiloQueryModel } from 'src/application/queries/query-models/sessions.milo.query.model'
import { isFailure, Result, success } from 'src/building-blocks/types/result'
import {
  SessionMilo,
  SessionMiloBeneficiaire
} from 'src/domain/milo/session.milo'
import { SessionParDossierJeuneDto } from 'src/infrastructure/clients/dto/milo.dto'
import { SessionMiloSqlModel } from 'src/infrastructure/sequelize/models/session-milo.sql-model'
import { SessionsMiloFetcher } from './sessions-milo.fetcher'
import { DateService } from '../../../../utils/date-service'
import { Authentification } from '../../../../domain/authentification'
import JeuneOuConseiller = Authentification.JeuneOuConseiller

export interface SessionMiloBeneficiaireAccueil extends SessionMiloBeneficiaire {
  fin: DateTime
  nomOffre: string
  theme: string
  typeOffre: SessionMilo.Offre['type']
  dateMaxInscriptionAffichee?: DateTime
}

// TODO: migrer get-sessions-jeune et get-mon-suivi-jeune vers ce getter (projection
// domaine), puis décommissionner GetSessionsVisiblesPourLeJeuneMiloQueryGetter.
@Injectable()
export class GetSessionsBeneficiaireAccueilMiloQueryGetter {
  constructor(private readonly fetcher: SessionsMiloFetcher) {}

  async handle(
    idJeune: string,
    utilisateur: JeuneOuConseiller,
    accessToken: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionMiloBeneficiaireAccueil[]>> {
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
        dtoToSessionMiloBeneficiaireAccueil(
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

function dtoToSessionMiloBeneficiaireAccueil(
  { session, offre, sessionInstance }: SessionParDossierJeuneDto,
  configuration: SessionMiloSqlModel | undefined,
  idDossier: string,
  timezone: string
): SessionMiloBeneficiaireAccueil {
  const idSession = session.id.toString()
  const debut = DateService.dateFromMilo(session.dateHeureDebut, timezone)
  const fin = DateService.dateFromMilo(session.dateHeureFin, timezone)
  const dateMaxInscriptionAffichee = session.dateMaxInscription
    ? DateService.dateStringToEndOfDayUtc(session.dateMaxInscription, timezone)
    : undefined
  const dateMaxDesinscription = SessionMilo.calculerDateMaxDesinscription(
    timezone,
    debut,
    dateMaxInscriptionAffichee
  )

  return {
    id: idSession,
    nom: session.nom,
    debut,
    fin,
    nbPlacesDisponibles: session.nbPlacesDisponibles ?? undefined,
    statutInscription: sessionInstance
      ? dtoToStatutInscription(sessionInstance.statut, session.id, idDossier)
      : undefined,
    autoinscription: configuration?.autoinscription ?? false,
    autodesinscription: configuration?.autodesinscription ?? false,
    dateMaxInscription: dateMaxInscriptionAffichee ?? debut,
    dateMaxDesinscription,
    nomOffre: offre.nom,
    theme: offre.theme,
    typeOffre: buildSessionTypeQueryModel(offre.type),
    dateMaxInscriptionAffichee
  }
}

export function mapSessionBeneficiaireAccueilToQueryModel(
  session: SessionMiloBeneficiaireAccueil,
  maintenant: DateTime
): SessionJeuneMiloQueryModel {
  return {
    id: session.id,
    nomSession: session.nom,
    nomOffre: session.nomOffre,
    dateHeureDebut: session.debut.toISO(),
    dateHeureFin: session.fin.toISO(),
    type: session.typeOffre,
    inscription: session.statutInscription,
    autoinscription: session.autoinscription,
    autodesinscription: SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
      session.autodesinscription,
      session.dateMaxDesinscription,
      maintenant
    ),
    dateMaxInscription: session.dateMaxInscriptionAffichee?.toISO(),
    nbPlacesRestantes: session.nbPlacesDisponibles,
    theme: session.theme
  }
}

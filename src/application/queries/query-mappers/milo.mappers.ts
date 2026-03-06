import { Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { ConfigurationLocale, SessionMilo } from 'src/domain/milo/session.milo'
import {
  MILO_INSCRIT,
  MILO_PRESENT,
  MILO_REFUS_JEUNE,
  MILO_REFUS_TIERS,
  OffreTypeCode,
  SessionConseillerDetailDto,
  SessionParDossierJeuneDto
} from 'src/infrastructure/clients/dto/milo.dto'
import {
  AgendaConseillerMiloSessionListItemQueryModel,
  DetailSessionConseillerMiloQueryModel,
  DetailSessionConseillerQueryModel,
  DetailSessionJeuneMiloQueryModel,
  InscritSessionMiloQueryModel,
  SessionConseillerMiloQueryModel,
  SessionJeuneMiloQueryModel,
  SessionTypeQueryModel
} from '../query-models/sessions.milo.query.model'

export const MILO_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss'

function dateMaxToISO(date: string, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone }).endOf('day').toUTC().toISO()
}

function buildSessionTypeQueryModel(
  type: OffreTypeCode
): SessionTypeQueryModel {
  switch (type) {
    case OffreTypeCode.WORKSHOP:
      return { code: type, label: 'Atelier' }
    case OffreTypeCode.COLLECTIVE_INFORMATION:
      return { code: type, label: 'Information collective' }
  }
}

export function mapSessionJeuneDtoToQueryModel(
  sessionDto: SessionParDossierJeuneDto,
  idDossier: string,
  timezone: string,
  maintenant: DateTime,
  configuration?: Pick<
    ConfigurationLocale,
    'autoinscription' | 'autodesinscription'
  >
): SessionJeuneMiloQueryModel {
  const dateHeureDebutDt = dateFromMilo(
    sessionDto.session.dateHeureDebut,
    timezone
  )
  const dateMaxInscriptionDt = sessionDto.session.dateMaxInscription
    ? DateTime.fromISO(sessionDto.session.dateMaxInscription, {
        zone: timezone
      }).endOf('day')
    : undefined

  const queryModel: SessionJeuneMiloQueryModel = {
    id: sessionDto.session.id.toString(),
    nomSession: sessionDto.session.nom,
    nomOffre: sessionDto.offre.nom,
    dateHeureDebut: dateHeureDebutDt.toISO(),
    dateHeureFin: dateFromMilo(
      sessionDto.session.dateHeureFin,
      timezone
    ).toISO(),
    type: buildSessionTypeQueryModel(sessionDto.offre.type),
    dateMaxInscription: sessionDto.session.dateMaxInscription
      ? dateMaxToISO(sessionDto.session.dateMaxInscription, timezone)
      : undefined,
    nbPlacesRestantes: sessionDto.session.nbPlacesDisponibles ?? undefined,
    autoinscription: false,
    autodesinscription: false,
    theme: sessionDto.offre.theme
  }

  if (sessionDto.sessionInstance) {
    queryModel.inscription = dtoToStatutInscription(
      sessionDto.sessionInstance.statut,
      sessionDto.session.id,
      idDossier
    )
  }

  if (configuration) {
    const dateMaxDesinscription = SessionMilo.calculerDateMaxDesinscription(
      dateHeureDebutDt,
      dateMaxInscriptionDt
    )
    queryModel.autoinscription = configuration.autoinscription
    queryModel.autodesinscription =
      SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
        configuration.autodesinscription,
        dateMaxDesinscription,
        maintenant
      )
  }

  return queryModel
}

export function mapSessionConseillerDtoToQueryModel(
  { offre, session }: SessionConseillerDetailDto,
  timezone: string,
  maintenant: DateTime,
  parametrage?: ConfigurationLocale
): SessionConseillerMiloQueryModel {
  const dateHeureDebut = dateFromMilo(session.dateHeureDebut, timezone)
  const dateHeureFin = dateFromMilo(session.dateHeureFin, timezone)
  const dateCloture = parametrage?.dateCloture
    ? DateTime.fromJSDate(parametrage.dateCloture)
    : undefined

  const participants = (session.instances ?? [])
    .map(({ idDossier, statut }) =>
      dtoToStatutInscription(statut, session.id, idDossier.toString())
    )
    .filter(statut => SessionMilo.Inscription.estInscrit(statut))
  const nombreParticipants = participants.length

  const autoinscription = parametrage?.autoinscription ?? false
  const autodesinscription = parametrage?.autodesinscription ?? false

  const queryModel: SessionConseillerMiloQueryModel = {
    id: session.id.toString(),
    nomSession: session.nom,
    nomOffre: offre.nom,
    estVisible: SessionMilo.estVisibleEffectif(
      parametrage?.estVisible ?? false,
      autoinscription
    ),
    autoinscription,
    autodesinscription,
    dateHeureDebut: dateHeureDebut.toISO(),
    dateHeureFin: dateHeureFin.toISO(),
    type: buildSessionTypeQueryModel(offre.type),
    statut: SessionMilo.calculerStatut(
      participants,
      maintenant,
      dateHeureDebut,
      dateCloture
    ),
    nombreParticipants
  }

  if (session.nbPlacesDisponibles !== null)
    queryModel.nombreMaxParticipants =
      session.nbPlacesDisponibles + nombreParticipants

  return queryModel
}

export function mapSessionConseillerDtoToAgendaQueryModel(
  sessionDto: SessionConseillerDetailDto,
  timezone: string,
  inscrits: InscritSessionMiloQueryModel[]
): AgendaConseillerMiloSessionListItemQueryModel {
  return {
    id: sessionDto.session.id.toString(),
    nomSession: sessionDto.session.nom,
    nomOffre: sessionDto.offre.nom,
    dateHeureDebut: dateFromMilo(
      sessionDto.session.dateHeureDebut,
      timezone
    ).toISO(),
    dateHeureFin: dateFromMilo(
      sessionDto.session.dateHeureFin,
      timezone
    ).toISO(),
    type: buildSessionTypeQueryModel(sessionDto.offre.type),
    beneficiaires: inscrits,
    nbPlacesRestantes: sessionDto.session.nbPlacesDisponibles ?? undefined,
    nbInscrits: inscrits.length
  }
}

export function mapDetailSessionJeuneDtoToQueryModel(
  sessionDto: SessionParDossierJeuneDto,
  beneficiaire: {
    idDossier: string
    timezone: string
  },
  configuration: Pick<
    ConfigurationLocale,
    'autoinscription' | 'autodesinscription'
  >
): DetailSessionJeuneMiloQueryModel {
  const queryModel: DetailSessionJeuneMiloQueryModel = {
    id: sessionDto.session.id.toString(),
    nomSession: sessionDto.session.nom,
    nomOffre: sessionDto.offre.nom,
    theme: sessionDto.offre.theme,
    type: buildSessionTypeQueryModel(sessionDto.offre.type),
    dateHeureDebut: dateFromMilo(
      sessionDto.session.dateHeureDebut,
      beneficiaire.timezone
    ).toISO(),
    dateHeureFin: dateFromMilo(
      sessionDto.session.dateHeureFin,
      beneficiaire.timezone
    ).toISO(),
    lieu: sessionDto.session.lieu,
    animateur: sessionDto.session.animateur,
    nomPartenaire: sessionDto.offre.nomPartenaire ?? undefined,
    description: sessionDto.offre.description ?? undefined,
    commentaire: sessionDto.session.commentaire ?? undefined,
    dateMaxInscription: sessionDto.session.dateMaxInscription
      ? dateMaxToISO(
          sessionDto.session.dateMaxInscription,
          beneficiaire.timezone
        )
      : undefined,
    dateMaxDesinscription: sessionDto.session.dateMaxDesinscription
      ? dateMaxToISO(
          sessionDto.session.dateMaxDesinscription,
          beneficiaire.timezone
        )
      : undefined,
    nbPlacesDisponibles: sessionDto.session.nbPlacesDisponibles ?? undefined,
    autoinscription: configuration.autoinscription,
    autodesinscription: configuration.autodesinscription
  }

  if (sessionDto.sessionInstance)
    queryModel.inscription = {
      statut: dtoToStatutInscription(
        sessionDto.sessionInstance.statut,
        sessionDto.session.id,
        beneficiaire.idDossier
      )
    }

  return queryModel
}

export function mapSessionToDetailSessionConseillerQueryModel(
  session: SessionMilo,
  maintenant: DateTime
): DetailSessionConseillerMiloQueryModel {
  const sessionQueryModel: DetailSessionConseillerQueryModel = {
    id: session.id,
    nom: session.nom,
    dateHeureDebut: session.debut.toUTC().toISO(),
    dateHeureFin: session.fin.toUTC().toISO(),
    animateur: session.animateur,
    lieu: session.lieu,
    estVisible: session.estVisible,
    autoinscription: session.autoinscription,
    autodesinscription: session.autodesinscription,
    statut: SessionMilo.calculerStatut(
      session.inscriptions.map(({ statut }) => statut),
      maintenant,
      session.debut,
      session.dateCloture
    )
  }

  if (session.dateMaxInscription) {
    sessionQueryModel.dateMaxInscription = session.dateMaxInscription
      .toUTC()
      .toISO()
  }
  if (session.nbPlacesDisponibles !== undefined)
    sessionQueryModel.nbPlacesDisponibles = session.nbPlacesDisponibles
  if (session.commentaire) sessionQueryModel.commentaire = session.commentaire

  return {
    session: sessionQueryModel,
    offre: session.offre,
    inscriptions: session.inscriptions.map(inscription => ({
      idJeune: inscription.idJeune,
      nom: inscription.nom,
      prenom: inscription.prenom,
      statut: inscription.statut
    }))
  }
}

export function dtoToStatutInscription(
  statut: string,
  idSession: number,
  idDossier: string
): SessionMilo.Inscription.Statut {
  switch (statut) {
    case MILO_INSCRIT:
      return SessionMilo.Inscription.Statut.INSCRIT
    case MILO_PRESENT:
      return SessionMilo.Inscription.Statut.PRESENT
    case MILO_REFUS_TIERS:
      return SessionMilo.Inscription.Statut.REFUS_TIERS
    case MILO_REFUS_JEUNE:
      return SessionMilo.Inscription.Statut.REFUS_JEUNE
    default:
      const logger = new Logger('SessionMilo.dtoToStatutInscription')
      logger.error(
        `Une inscription a un statut inconnu : session ${idSession}, dossier ${idDossier}`
      )
      return SessionMilo.Inscription.Statut.INSCRIT
  }
}

function dateFromMilo(dateMilo: string, timezone: string): DateTime {
  return DateTime.fromFormat(dateMilo, MILO_DATE_FORMAT, {
    zone: timezone
  }).toUTC()
}

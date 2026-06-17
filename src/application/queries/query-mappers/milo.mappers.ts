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
import { DateService } from '../../../utils/date-service'

export function buildSessionTypeQueryModel(
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
  const dateHeureDebutDt = DateService.dateFromMilo(
    sessionDto.session.dateHeureDebut,
    timezone
  )
  const dateMaxInscriptionDt = sessionDto.session.dateMaxInscription
    ? DateService.dateStringToEndOfDayUtc(
        sessionDto.session.dateMaxInscription,
        timezone
      )
    : undefined

  const queryModel: SessionJeuneMiloQueryModel = {
    id: sessionDto.session.id.toString(),
    nomSession: sessionDto.session.nom,
    nomOffre: sessionDto.offre.nom,
    dateHeureDebut: dateHeureDebutDt.toISO(),
    dateHeureFin: DateService.dateFromMilo(
      sessionDto.session.dateHeureFin,
      timezone
    ).toISO(),
    type: buildSessionTypeQueryModel(sessionDto.offre.type),
    dateMaxInscription: dateMaxInscriptionDt?.toISO(),
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
      timezone,
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
  const dateHeureDebut = DateService.dateFromMilo(
    session.dateHeureDebut,
    timezone
  )
  const dateHeureFin = DateService.dateFromMilo(session.dateHeureFin, timezone)
  const dateCloture = parametrage?.dateCloture
    ? DateTime.fromJSDate(parametrage.dateCloture)
    : undefined

  const participants = (session.instances ?? [])
    .map(({ idDossier, statut }) =>
      dtoToStatutInscription(statut, session.id, idDossier.toString())
    )
    .filter(statut => SessionMilo.Inscription.estInscrit(statut))
  const nombreParticipants = participants.length

  const queryModel: SessionConseillerMiloQueryModel = {
    id: session.id.toString(),
    nomSession: session.nom,
    nomOffre: offre.nom,
    estVisible: parametrage?.estVisible ?? false,
    autoinscription: parametrage?.autoinscription ?? false,
    autodesinscription: parametrage?.autodesinscription ?? false,
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
    dateHeureDebut: DateService.dateFromMilo(
      sessionDto.session.dateHeureDebut,
      timezone
    ).toISO(),
    dateHeureFin: DateService.dateFromMilo(
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
  >,
  maintenant: DateTime
): DetailSessionJeuneMiloQueryModel {
  const dateHeureDebutDt = DateService.dateFromMilo(
    sessionDto.session.dateHeureDebut,
    beneficiaire.timezone
  )
  const dateMaxInscriptionDt = sessionDto.session.dateMaxInscription
    ? DateService.dateStringToEndOfDayUtc(
        sessionDto.session.dateMaxInscription,
        beneficiaire.timezone
      )
    : undefined
  const dateMaxDesinscription = SessionMilo.calculerDateMaxDesinscription(
    beneficiaire.timezone,
    dateHeureDebutDt,
    dateMaxInscriptionDt
  )

  const queryModel: DetailSessionJeuneMiloQueryModel = {
    id: sessionDto.session.id.toString(),
    nomSession: sessionDto.session.nom,
    nomOffre: sessionDto.offre.nom,
    theme: sessionDto.offre.theme,
    type: buildSessionTypeQueryModel(sessionDto.offre.type),
    dateHeureDebut: dateHeureDebutDt.toISO(),
    dateHeureFin: DateService.dateFromMilo(
      sessionDto.session.dateHeureFin,
      beneficiaire.timezone
    ).toISO(),
    lieu: sessionDto.session.lieu,
    animateur: sessionDto.session.animateur,
    nomPartenaire: sessionDto.offre.nomPartenaire ?? undefined,
    description: sessionDto.offre.description ?? undefined,
    commentaire: sessionDto.session.commentaire ?? undefined,
    dateMaxInscription: dateMaxInscriptionDt?.toUTC().toISO(),
    dateMaxDesinscription: dateMaxDesinscription.toUTC().toISO(),
    nbPlacesDisponibles: sessionDto.session.nbPlacesDisponibles ?? undefined,
    autoinscription: configuration.autoinscription,
    autodesinscription: SessionMilo.autodesinscriptionEffectivePourBeneficiaire(
      configuration.autodesinscription,
      dateMaxDesinscription,
      maintenant
    )
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
    dateMaxInscription: session.dateMaxInscription.toUTC().toISO(),
    dateMaxDesinscription: session.dateMaxDesinscription.toUTC().toISO(),
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

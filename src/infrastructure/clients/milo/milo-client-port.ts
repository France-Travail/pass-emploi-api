import { Result } from 'src/building-blocks/types/result'
import { JeuneMilo } from '../../../domain/milo/jeune.milo'
import { DateTime } from 'luxon'
import {
  InscrireJeuneSessionDto,
  InscritSessionMiloDto,
  SessionConseillerDetailDto,
  SessionParDossierJeuneDto,
  StructureConseillerMiloDto
} from '../dto/milo.dto'
import {
  EvenementMiloDto,
  InstanceSessionMiloDto,
  RendezVousMiloDto
} from '../../repositories/dto/milo.dto'

export interface MiloClientPort {
  /* ************ */
  /* API DOSSIERS */
  /* ************ */
  getDossier(idDossier: string): Promise<Result<JeuneMilo.Dossier>>

  creerSituationDossier(
    idDossier: string,
    body: {
      dateDebut: string
      dateFinReelle: string
      commentaire: string | undefined
      mesure: string
      loginConseiller: string
    }
  ): Promise<Result>

  /* ********* */
  /* API JEUNE */
  /* ********* */
  creerJeune(
    idDossier: string,
    surcharge?: boolean
  ): Promise<
    Result<{ idAuthentification?: string; existeDejaChezMilo: boolean }>
  >

  /* ************ */
  /* API SESSIONS */
  /* ************ */
  getSessionsConseillerParStructure(
    idpToken: string,
    idStructure: string,
    timezone: string,
    options: {
      periode: { debut?: DateTime; fin?: DateTime }
    }
  ): Promise<Result<SessionConseillerDetailDto[]>>

  getSessionsParDossierJeune(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>>

  getSessionsParDossierJeunePourConseiller(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>>

  getDetailSessionConseiller(
    idpToken: string,
    idSession: string
  ): Promise<Result<SessionConseillerDetailDto>>

  getDetailSessionJeune(
    idpToken: string,
    idSession: string,
    idDossier: string,
    timezone: string
  ): Promise<Result<SessionParDossierJeuneDto>>

  getListeInscritsSession(
    idpToken: string,
    idSession: string
  ): Promise<Result<InscritSessionMiloDto[]>>

  inscrireJeunesSession(
    idpToken: string,
    idSession: string,
    idsDossier: string[]
  ): Promise<Result<InscrireJeuneSessionDto[]>>

  desinscrireJeunesSession(
    idpToken: string,
    desinscriptions: Array<{ idDossier: string; idInstanceSession: string }>
  ): Promise<Result>

  modifierInscriptionJeunesSession(
    idpToken: string,
    modifications: Array<{
      idDossier: string
      idInstanceSession: string
      statut: string
      commentaire?: string
      dateDebutReelle?: string
    }>
  ): Promise<Result>

  getInstanceSession(
    idInstance: string,
    idDossier: string
  ): Promise<Result<InstanceSessionMiloDto>>

  /* **************** */
  /* API UTILISATEURS */
  /* **************** */
  getStructureConseiller(
    idpToken: string
  ): Promise<Result<StructureConseillerMiloDto>>

  /* ******* */
  /* API RDV */
  /* ******* */
  getRendezVous(
    idDossier: string,
    idRendezVous: string
  ): Promise<Result<RendezVousMiloDto>>

  /* *************** */
  /* API EVENEMENTS  */
  /* *************** */
  getEvenements(): Promise<Result<EvenementMiloDto[]>>

  acquitterEvenement(idEvenement: string): Promise<Result>

  /* ******** */
  /* API MAIL */
  /********** */
  envoyerEmailActivation(idpToken: string, email: string): Promise<Result>
}

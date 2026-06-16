import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import {
  ErreurHttp,
  ErreurMiloHttp
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  Result,
  success
} from 'src/building-blocks/types/result'
import { DateService } from '../../../utils/date-service'
import { RateLimiterService } from '../../../utils/rate-limiter.service'
import {
  InscrireJeuneSessionDto,
  InscritSessionMiloDto,
  ListeSessionsConseillerMiloDto,
  ListeSessionsJeuneMiloDto,
  SessionConseillerDetailDto,
  SessionJeuneDetailDto,
  SessionParDossierJeuneDto,
  StructureConseillerMiloDto
} from '../dto/milo.dto'
import { MiloClientUtils } from './milo-client-utils'
import { JeuneMilo } from '../../../domain/milo/jeune.milo'
import {
  DossierMiloDto,
  EvenementMiloDto,
  InstanceSessionMiloDto,
  RendezVousMiloDto
} from '../../repositories/dto/milo.dto'
import { MiloClientPort } from './milo-client-port'

export const TAILLE_PAGE_MAX_APIS_MILO: number = 150

@Injectable()
export class MiloClientV1 implements MiloClientPort {
  private readonly apiKeyDossierCej: string
  private readonly apiKeyDossier: string
  private readonly apiKeyCreerJeune: string
  private readonly apiKeySessionsListeConseiller: string
  private readonly apiKeySessionsDetailEtListeJeune: string
  private readonly apiKeySessionDetailConseiller: string
  private readonly apiKeyInstanceSessionEcritureConseiller: string
  private readonly apiKeyEnvoiEmail: string
  private readonly apiKeyUtilisateurs: string
  private readonly apiKeyEvents: string
  private readonly apiKeyDetailRendezVous: string

  constructor(
    private readonly miloClientUtils: MiloClientUtils,
    private readonly configService: ConfigService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly dateService: DateService
  ) {
    this.apiKeyDossierCej = this.configService.get('milo').apiKeyDossierCej
    this.apiKeyDossier = this.configService.get('milo').apiKeyDossierV1
    this.apiKeyCreerJeune = this.configService.get('milo').apiKeyCreerJeune
    this.apiKeySessionsListeConseiller =
      this.configService.get('milo').apiKeySessionsListeConseiller
    this.apiKeySessionsDetailEtListeJeune =
      this.configService.get('milo').apiKeySessionsDetailEtListeJeune
    this.apiKeySessionDetailConseiller =
      this.configService.get('milo').apiKeySessionDetailConseiller
    this.apiKeyInstanceSessionEcritureConseiller =
      this.configService.get('milo').apiKeyInstanceSessionEcritureConseiller
    this.apiKeyUtilisateurs = this.configService.get('milo').apiKeyUtilisateurs
    this.apiKeyEnvoiEmail = this.configService.get('milo').apiKeyEnvoiEmail
    this.apiKeyEvents = this.configService.get('milo').apiKeyEvents
    this.apiKeyDetailRendezVous =
      this.configService.get('milo').apiKeyDetailRendezVous
  }

  /* ************ */
  /* API DOSSIERS */
  /* ************ */
  async getDossier(idDossier: string): Promise<Result<JeuneMilo.Dossier>> {
    await this.rateLimiterService.dossierMiloRateLimiter.attendreLaProchaineDisponibilite()
    const result = await this.miloClientUtils.get<DossierMiloDto>({
      suffixUrl: `api-dossiers-cej/dossiers/${idDossier}`,
      auth: {
        apiKey: this.apiKeyDossierCej
      }
    })
    if (isFailure(result)) {
      const erreurHttp = result.error as ErreurMiloHttp
      if (erreurHttp.statusCode === 400)
        return failure(
          new ErreurHttp(
            'Le numéro de dossier est incorrect. Renseignez un numéro. Exemple : 123456.',
            erreurHttp.statusCode
          )
        )
      if (
        erreurHttp.statusCode > HttpStatus.BAD_REQUEST &&
        erreurHttp.statusCode <= HttpStatus.NOT_FOUND
      ) {
        return result
      }
      throw result.error
    }

    return success({
      id: idDossier,
      prenom: result.data.prenom,
      nom: result.data.nomUsage,
      email: result.data.mail ?? undefined,
      codePostal: result.data.adresse?.codePostal ?? '',
      dateDeNaissance: result.data.dateNaissance,
      dateFinCEJ: DateService.fromStringToDateTime(
        result.data.accompagnementCEJ.dateFinPrevue
      ),
      situations: result.data.situationsCEJ.map(situation => {
        return {
          etat: situation.etat,
          categorie: situation.categorieSituation,
          dateFin: situation.dateFin ?? undefined
        }
      }),
      codeStructure: result.data.structureRattachement?.codeStructure
    })
  }

  async creerSituationDossier(
    idDossier: string,
    body: {
      dateDebut: string
      dateFinReelle: string
      commentaire: string | undefined
      mesure: string
      loginConseiller: string
    }
  ): Promise<Result> {
    await this.rateLimiterService.dossierMiloRateLimiter.attendreLaProchaineDisponibilite()
    return await this.miloClientUtils.post({
      suffixUrl: `sue/dossiers/${idDossier}/situation`,
      payload: body,
      auth: { apiKey: this.apiKeyDossier }
    })
  }

  /* ********* */
  /* API JEUNE */
  /* ********* */
  async creerJeune(
    idDossier: string,
    _idpToken: string,
    surcharge?: boolean
  ): Promise<
    Result<{ idAuthentification?: string; existeDejaChezMilo: boolean }>
  > {
    let response
    response = surcharge
      ? await this.miloClientUtils.put<string>({
          suffixUrl: `sue/compte-jeune/surcharge/${idDossier}`,
          payload: {},
          auth: { apiKey: this.apiKeyCreerJeune }
        })
      : await this.miloClientUtils.post<string>({
          suffixUrl: `sue/compte-jeune/${idDossier}`,
          payload: {},
          auth: { apiKey: this.apiKeyCreerJeune }
        })

    if (isSuccess(response)) {
      if (surcharge && !response.data) {
        response = await this.miloClientUtils.post<string>({
          suffixUrl: `sue/compte-jeune/${idDossier}`,
          payload: {},
          auth: { apiKey: this.apiKeyCreerJeune }
        })
      }
      if (isSuccess(response)) {
        return success({
          idAuthentification: response.data || undefined,
          existeDejaChezMilo: false
        })
      }
    }
    const erreurHttp = response.error as ErreurMiloHttp
    if (erreurHttp.codeMilo === 'SUE_ACCOUNT_EXISTING_OTHER_ML') {
      return failure(new ErreurMiloHttp(erreurHttp.message, 422))
    }

    if (erreurHttp.statusCode >= 400 && erreurHttp.statusCode <= 404) {
      if (erreurHttp.codeMilo === 'SUE_RECORD_ALREADY_ATTACHED_TO_ACCOUNT') {
        if (erreurHttp.idKeycloak) {
          return success({
            idAuthentification: erreurHttp.idKeycloak,
            existeDejaChezMilo: true
          })
        }
      }
    }

    return response
  }

  /* ************ */
  /* API SESSIONS */
  /* ************ */
  async getSessionsConseillerParStructure(
    idpToken: string,
    idStructure: string,
    timezone: string,
    options: {
      periode: { debut?: DateTime; fin?: DateTime }
    }
  ): Promise<Result<SessionConseillerDetailDto[]>> {
    const params = new URLSearchParams()
    params.append('taillePage', TAILLE_PAGE_MAX_APIS_MILO.toString())
    params.append('rechercheInscrits', 'true')
    // toISODate() tronque au jour : l'API MiLo ne filtre pas à l'heure
    if (options.periode.debut) {
      const debutRecherche = options.periode.debut.setZone(timezone)
      params.append('dateDebutRecherche', debutRecherche.toISODate())
    }
    if (options.periode.fin) {
      const finRecherche = options.periode.fin.setZone(timezone)
      params.append('dateFinRecherche', finRecherche.toISODate())
    }

    await this.rateLimiterService.sessionsStructureMiloRateLimiter.attendreLaProchaineDisponibilite()

    // On assure jusqu'à 300 résultats
    const sessions: SessionConseillerDetailDto[] = []
    const dtoResult =
      await this.miloClientUtils.get<ListeSessionsConseillerMiloDto>({
        suffixUrl: `operateurs/structures/${idStructure}/sessions`,
        auth: {
          apiKey: this.apiKeySessionsListeConseiller,
          idpToken
        },
        params
      })
    if (isFailure(dtoResult)) {
      return dtoResult
    }
    sessions.push(...dtoResult.data.sessions)
    if (dtoResult.data.sessions.length >= TAILLE_PAGE_MAX_APIS_MILO) {
      params.append('page', '2')
      const dtoPage2Result =
        await this.miloClientUtils.get<ListeSessionsConseillerMiloDto>({
          suffixUrl: `operateurs/structures/${idStructure}/sessions`,
          auth: {
            apiKey: this.apiKeySessionsListeConseiller,
            idpToken
          },
          params
        })
      if (isSuccess(dtoPage2Result)) {
        sessions.push(...dtoPage2Result.data.sessions)
      }
    }
    return success(sessions)
  }

  async getSessionsParDossierJeune(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    await this.rateLimiterService.sessionsJeuneMiloRateLimiter.attendreLaProchaineDisponibilite()
    return this.recupererSessionsParDossierJeune(
      idpToken,
      idDossier,
      this.apiKeySessionsDetailEtListeJeune,
      periode
    )
  }

  async getSessionsParDossierJeunePourConseiller(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    await this.rateLimiterService.sessionsConseillerMiloRateLimiter.attendreLaProchaineDisponibilite()
    return this.recupererSessionsParDossierJeune(
      idpToken,
      idDossier,
      this.apiKeySessionDetailConseiller,
      periode
    )
  }

  async getDetailSessionConseiller(
    idpToken: string,
    idSession: string
  ): Promise<Result<SessionConseillerDetailDto>> {
    await this.rateLimiterService.sessionsConseillerMiloRateLimiter.attendreLaProchaineDisponibilite()
    return this.miloClientUtils.get<SessionConseillerDetailDto>({
      suffixUrl: `operateurs/sessions/${idSession}`,
      auth: {
        apiKey: this.apiKeySessionDetailConseiller,
        idpToken
      }
    })
  }

  async getDetailSessionJeune(
    idpToken: string,
    idSession: string,
    idDossier: string,
    timezone: string
  ): Promise<Result<SessionParDossierJeuneDto>> {
    await this.rateLimiterService.sessionsJeuneMiloRateLimiter.attendreLaProchaineDisponibilite()
    const resultDetail = await this.miloClientUtils.get<SessionJeuneDetailDto>({
      suffixUrl: `operateurs/sessions/${idSession}`,
      auth: {
        apiKey: this.apiKeySessionsDetailEtListeJeune,
        idpToken
      }
    })
    if (isFailure(resultDetail)) {
      return resultDetail
    }
    const detailSessionDto = resultDetail.data
    const dateSession = DateService.dateFromMilo(
      detailSessionDto.session.dateHeureDebut,
      timezone
    )

    const resultSessionsParDossier = await this.getSessionsParDossierJeune(
      idpToken,
      idDossier,
      { debut: dateSession, fin: dateSession }
    )
    if (isFailure(resultSessionsParDossier)) {
      return resultSessionsParDossier
    }
    const dtoAvecInscription = resultSessionsParDossier.data.find(
      session => session.session.id.toString() === idSession
    )

    return success({
      ...detailSessionDto,
      sessionInstance: dtoAvecInscription?.sessionInstance
    })
  }

  async getListeInscritsSession(
    idpToken: string,
    idSession: string
  ): Promise<Result<InscritSessionMiloDto[]>> {
    await this.rateLimiterService.sessionsConseillerMiloRateLimiter.attendreLaProchaineDisponibilite()
    return this.miloClientUtils.get<InscritSessionMiloDto[]>({
      suffixUrl: `operateurs/sessions/${idSession}/inscrits`,
      auth: {
        apiKey: this.apiKeySessionDetailConseiller,
        idpToken
      }
    })
  }

  async inscrireJeunesSession(
    idpToken: string,
    idSession: string,
    idsDossier: string[]
  ): Promise<Result<InscrireJeuneSessionDto[]>> {
    const dto: InscrireJeuneSessionDto[] = []
    for (const idDossier of idsDossier) {
      const result = await this.miloClientUtils.post<InscrireJeuneSessionDto>({
        suffixUrl: `operateurs/dossiers/${idDossier}/instances-session`,
        payload: idSession,
        auth: {
          apiKey: this.apiKeyInstanceSessionEcritureConseiller,
          idpToken
        }
      })
      if (isFailure(result)) {
        return result
      }
      if (result.data) {
        dto.push(result.data)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return success(dto)
  }

  async desinscrireJeunesSession(
    idpToken: string,
    desinscriptions: Array<{ idDossier: string; idInstanceSession: string }>
  ): Promise<Result> {
    for (const desinscription of desinscriptions) {
      const result = await this.miloClientUtils.delete({
        suffixUrl: `operateurs/dossiers/${desinscription.idDossier}/instances-session/${desinscription.idInstanceSession}`,
        auth: { apiKey: this.apiKeyInstanceSessionEcritureConseiller, idpToken }
      })
      if (isFailure(result)) return result
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return emptySuccess()
  }

  async modifierInscriptionJeunesSession(
    idpToken: string,
    modifications: Array<{
      idDossier: string
      idInstanceSession: string
      statut: string
      commentaire?: string
      dateDebutReelle?: string
    }>
  ): Promise<Result> {
    for (const modification of modifications) {
      const result = await this.miloClientUtils.put({
        suffixUrl: `operateurs/dossiers/${modification.idDossier}/instances-session/${modification.idInstanceSession}`,
        payload: {
          statut: modification.statut,
          commentaire: modification.commentaire,
          dateDebutReelle: modification.dateDebutReelle
        },
        auth: { apiKey: this.apiKeyInstanceSessionEcritureConseiller, idpToken }
      })
      if (isFailure(result)) return result
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return emptySuccess()
  }

  async getInstanceSession(
    idInstance: string,
    idDossier: string
  ): Promise<Result<InstanceSessionMiloDto>> {
    await this.rateLimiterService.dossierSessionRDVMiloRateLimiter.attendreLaProchaineDisponibilite()
    const result = await this.miloClientUtils.get<InstanceSessionMiloDto>({
      suffixUrl: `operateurs/dossiers/${idDossier}/sessions/${idInstance}`,
      auth: { apiKey: this.apiKeyDetailRendezVous },
      operateur: 'applicationcej'
    })
    if (
      isFailure(result) &&
      (result.error as ErreurMiloHttp).statusCode !== HttpStatus.NOT_FOUND
    ) {
      throw result.error
    }
    return result
  }

  private async recupererSessionsParDossierJeune(
    idpToken: string,
    idDossier: string,
    apiKey: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    const params = new URLSearchParams()
    params.append('idDossier', idDossier)
    params.append('taillePage', TAILLE_PAGE_MAX_APIS_MILO.toString())
    // toISODate() tronque au jour : l'API MiLo ne filtre pas à l'heure
    if (periode?.debut) {
      params.append('dateDebutRecherche', periode.debut.toISODate())
    }

    let fin = periode?.fin
    if (!fin) {
      const debut = periode?.debut ?? this.dateService.now()
      fin = debut.plus({ months: 3 })
    }
    params.append('dateFinRecherche', fin.toISODate())

    // On assure jusqu'à 300 résultats
    const sessions: SessionParDossierJeuneDto[] = []
    const dtoResult = await this.miloClientUtils.get<ListeSessionsJeuneMiloDto>(
      {
        suffixUrl: `operateurs/sessions`,
        auth: {
          apiKey,
          idpToken
        },
        params
      }
    )
    if (isFailure(dtoResult)) {
      return dtoResult
    }
    sessions.push(...dtoResult.data.sessions)
    if (dtoResult.data.sessions.length >= TAILLE_PAGE_MAX_APIS_MILO) {
      params.append('page', '2')
      const dtoPage2Result =
        await this.miloClientUtils.get<ListeSessionsJeuneMiloDto>({
          suffixUrl: `operateurs/sessions`,
          auth: {
            apiKey,
            idpToken
          },
          params
        })
      if (isSuccess(dtoPage2Result)) {
        sessions.push(...dtoPage2Result.data.sessions)
      }
    }
    return success(sessions)
  }

  /* **************** */
  /* API UTILISATEURS */
  /* **************** */
  async getStructureConseiller(
    idpToken: string
  ): Promise<Result<StructureConseillerMiloDto>> {
    await this.rateLimiterService.structuresMiloRateLimiter.attendreLaProchaineDisponibilite()
    const resultStructures = await this.miloClientUtils.get<
      StructureConseillerMiloDto[]
    >({
      suffixUrl: `operateurs/utilisateurs/moi/structures`,
      auth: {
        apiKey: this.apiKeyUtilisateurs,
        idpToken
      }
    })

    if (isFailure(resultStructures)) {
      return resultStructures
    }
    const structurePrincipale = resultStructures.data.find(
      structureMilo => structureMilo.principale
    )
    if (!structurePrincipale) {
      return failure(
        new ErreurMiloHttp('Structure Milo principale introuvable', 404)
      )
    }
    return success(structurePrincipale)
  }

  /* ******* */
  /* API RDV */
  /* ******* */

  async getRendezVous(
    idDossier: string,
    idRendezVous: string
  ): Promise<Result<RendezVousMiloDto>> {
    await this.rateLimiterService.dossierSessionRDVMiloRateLimiter.attendreLaProchaineDisponibilite()
    const result = await this.miloClientUtils.get<RendezVousMiloDto>({
      suffixUrl: `operateurs/dossiers/${idDossier}/rdv/${idRendezVous}`,
      auth: { apiKey: this.apiKeyDetailRendezVous },
      operateur: 'applicationcej'
    })
    if (
      isFailure(result) &&
      (result.error as ErreurMiloHttp).statusCode !== HttpStatus.NOT_FOUND
    ) {
      throw result.error
    }
    return result
  }

  /* *************** */
  /* API EVENEMENTS  */
  /* *************** */
  async getEvenements(): Promise<Result<EvenementMiloDto[]>> {
    await this.rateLimiterService.evenementsMiloRateLimiter.attendreLaProchaineDisponibilite()
    return this.miloClientUtils.get<EvenementMiloDto[]>({
      suffixUrl: `api-evenements/events`,
      auth: { apiKey: this.apiKeyEvents }
    })
  }

  async acquitterEvenement(idEvenement: string): Promise<Result> {
    await this.rateLimiterService.evenementsMiloRateLimiter.attendreLaProchaineDisponibilite()
    return await this.miloClientUtils.post({
      suffixUrl: `api-evenements/events/${idEvenement}/ack`,
      payload: {},
      auth: { apiKey: this.apiKeyEvents }
    })
  }

  /* ******** */
  /* API MAIL */
  /********** */
  async envoyerEmailActivation(
    idpToken: string,
    email: string
  ): Promise<Result> {
    return await this.miloClientUtils.put({
      suffixUrl: `sue/sendVerifyEmail`,
      payload: email,
      contentType: 'text/plain',
      auth: {
        apiKey: this.apiKeyEnvoiEmail,
        idpToken
      }
    })
  }
}

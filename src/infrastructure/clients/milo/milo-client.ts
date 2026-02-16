import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Context, ContextKey } from 'src/building-blocks/context'
import { Result } from 'src/building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { JeuneMilo } from '../../../domain/milo/jeune.milo'
import {
  EvenementMiloDto,
  InstanceSessionMiloDto,
  RendezVousMiloDto
} from '../../repositories/dto/milo.dto'
import {
  InscrireJeuneSessionDto,
  InscritSessionMiloDto,
  SessionConseillerDetailDto,
  SessionParDossierJeuneDto,
  StructureConseillerMiloDto
} from '../dto/milo.dto'
import { MiloClientPort } from './milo-client-port'
import { MiloClientV1 } from './milo-client-v1'
import { MiloClientV2 } from './milo-client-v2'

@Injectable()
export class MiloClient implements MiloClientPort {
  private readonly apiV2Enabled: boolean
  private readonly emailsConseillersV2: string[]
  private readonly logger: Logger

  constructor(
    private readonly configService: ConfigService,
    private readonly miloClientV1: MiloClientV1,
    private readonly miloClientV2: MiloClientV2,
    private readonly context: Context
  ) {
    this.apiV2Enabled = this.configService.get('milo').apiV2Enabled
    this.emailsConseillersV2 =
      this.configService.get('milo').emailsConseillersV2
    this.logger = new Logger('MiloClient')
  }

  /* ************ */
  /* API DOSSIERS */
  /* ************ */

  async getDossier(idDossier: string): Promise<Result<JeuneMilo.Dossier>> {
    return this.getClient().getDossier(idDossier)
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
    return this.getClient().creerSituationDossier(idDossier, body)
  }

  /* ********* */
  /* API JEUNE */
  /* ********* */

  async creerJeune(
    idDossier: string,
    idpToken: string,
    surcharge?: boolean
  ): Promise<
    Result<{ idAuthentification?: string; existeDejaChezMilo: boolean }>
  > {
    return this.getClient().creerJeune(idDossier, idpToken, surcharge)
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
    return this.getClient().getSessionsConseillerParStructure(
      idpToken,
      idStructure,
      timezone,
      options
    )
  }

  async getSessionsParDossierJeune(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    return this.getClient().getSessionsParDossierJeune(
      idpToken,
      idDossier,
      periode
    )
  }

  async getSessionsParDossierJeunePourConseiller(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    return this.getClient().getSessionsParDossierJeunePourConseiller(
      idpToken,
      idDossier,
      periode
    )
  }

  async getDetailSessionConseiller(
    idpToken: string,
    idSession: string
  ): Promise<Result<SessionConseillerDetailDto>> {
    return this.getClient().getDetailSessionConseiller(idpToken, idSession)
  }

  async getDetailSessionJeune(
    idpToken: string,
    idSession: string,
    idDossier: string,
    timezone: string
  ): Promise<Result<SessionParDossierJeuneDto>> {
    return this.getClient().getDetailSessionJeune(
      idpToken,
      idSession,
      idDossier,
      timezone
    )
  }

  async getListeInscritsSession(
    idpToken: string,
    idSession: string
  ): Promise<Result<InscritSessionMiloDto[]>> {
    return this.getClient().getListeInscritsSession(idpToken, idSession)
  }

  async inscrireJeunesSession(
    idpToken: string,
    idSession: string,
    idsDossier: string[]
  ): Promise<Result<InscrireJeuneSessionDto[]>> {
    return this.getClient().inscrireJeunesSession(
      idpToken,
      idSession,
      idsDossier
    )
  }

  async desinscrireJeunesSession(
    idpToken: string,
    desinscriptions: Array<{ idDossier: string; idInstanceSession: string }>
  ): Promise<Result> {
    return this.getClient().desinscrireJeunesSession(idpToken, desinscriptions)
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
    return this.getClient().modifierInscriptionJeunesSession(
      idpToken,
      modifications
    )
  }

  async getInstanceSession(
    idInstance: string,
    idDossier: string
  ): Promise<Result<InstanceSessionMiloDto>> {
    return this.getClient().getInstanceSession(idInstance, idDossier)
  }

  /* **************** */
  /* API UTILISATEURS */
  /* **************** */

  async getStructureConseiller(
    idpToken: string
  ): Promise<Result<StructureConseillerMiloDto>> {
    return this.getClient().getStructureConseiller(idpToken)
  }

  /* ******* */
  /* API RDV */
  /* ******* */

  async getRendezVous(
    idDossier: string,
    idRendezVous: string
  ): Promise<Result<RendezVousMiloDto>> {
    return this.getClient().getRendezVous(idDossier, idRendezVous)
  }

  /* *************** */
  /* API EVENEMENTS  */
  /* *************** */

  async getEvenements(): Promise<Result<EvenementMiloDto[]>> {
    return this.getClient().getEvenements()
  }

  async acquitterEvenement(idEvenement: string): Promise<Result> {
    return this.getClient().acquitterEvenement(idEvenement)
  }

  /* ******** */
  /* API MAIL */
  /********** */

  async envoyerEmailActivation(
    idpToken: string,
    email: string
  ): Promise<Result> {
    return this.getClient().envoyerEmailActivation(idpToken, email)
  }

  private getClient(): MiloClientPort {
    let useV2 = this.apiV2Enabled && this.emailsConseillersV2?.length > 0

    const utilisateur = this.context.get<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )

    if (useV2 && utilisateur) {
      useV2 =
        utilisateur.type === Authentification.Type.CONSEILLER &&
        utilisateur.email !== undefined &&
        this.emailsConseillersV2.includes(utilisateur.email)
    } else {
      useV2 = false
    }

    this.logger.log(
      `Détermination du client Milo pour ${utilisateur?.type} - ${utilisateur?.email}`
    )

    const miloClient = useV2 ? this.miloClientV2 : this.miloClientV1
    this.logger.log(`Sélection du client ${miloClient.constructor.name}`)
    return miloClient
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Context, ContextKey } from 'src/building-blocks/context'
import {
  Failure,
  isFailure,
  Result,
  success
} from 'src/building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import {
  CacheApiPartenaireService,
  StatutResultatCache
} from '../cache-api-partenaire.service.db'
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
import { SequelizeInjectionToken } from '../../sequelize/providers'
import { QueryTypes, Sequelize } from 'sequelize'

@Injectable()
export class MiloClient implements MiloClientPort {
  private readonly apiV2Enabled: boolean
  private readonly emailsConseillersV2: string[]

  constructor(
    private readonly configService: ConfigService,
    private readonly miloClientV1: MiloClientV1,
    private readonly miloClientV2: MiloClientV2,
    private readonly context: Context,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    private readonly cacheApiPartenaire: CacheApiPartenaireService
  ) {
    this.apiV2Enabled = this.configService.get('milo').apiV2Enabled
    this.emailsConseillersV2 =
      this.configService.get('milo').emailsConseillersV2
  }

  /* ************ */
  /* API DOSSIERS */
  /* ************ */

  async getDossier(idDossier: string): Promise<Result<JeuneMilo.Dossier>> {
    return (await this.getClient()).getDossier(idDossier)
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
    return (await this.getClient()).creerSituationDossier(idDossier, body)
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
    return (await this.getClient()).creerJeune(idDossier, idpToken, surcharge)
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
    const cleCache = `milo/conseiller/structures/${idStructure}/sessions${suffixePeriode(
      options.periode,
      timezone
    )}`
    return this.avecCache(cleCache, async () =>
      (await this.getClient()).getSessionsConseillerParStructure(
        idpToken,
        idStructure,
        timezone,
        options
      )
    )
  }

  async getSessionsParDossierJeune(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    const cleCache = `milo/jeune/dossiers/${idDossier}/sessions${suffixePeriode(
      periode
    )}`
    return this.avecCache(cleCache, async () =>
      (await this.getClient()).getSessionsParDossierJeune(
        idpToken,
        idDossier,
        periode
      )
    )
  }

  async getSessionsParDossierJeunePourConseiller(
    idpToken: string,
    idDossier: string,
    periode?: { debut?: DateTime; fin?: DateTime }
  ): Promise<Result<SessionParDossierJeuneDto[]>> {
    const cleCache = `milo/conseiller/dossiers/${idDossier}/sessions${suffixePeriode(
      periode
    )}`
    return this.avecCache(cleCache, async () =>
      (await this.getClient()).getSessionsParDossierJeunePourConseiller(
        idpToken,
        idDossier,
        periode
      )
    )
  }

  async getDetailSessionConseiller(
    idpToken: string,
    idSession: string
  ): Promise<Result<SessionConseillerDetailDto>> {
    return (await this.getClient()).getDetailSessionConseiller(
      idpToken,
      idSession
    )
  }

  async getDetailSessionJeune(
    idpToken: string,
    idSession: string,
    idDossier: string,
    timezone: string
  ): Promise<Result<SessionParDossierJeuneDto>> {
    return (await this.getClient()).getDetailSessionJeune(
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
    return (await this.getClient()).getListeInscritsSession(idpToken, idSession)
  }

  async inscrireJeunesSession(
    idpToken: string,
    idSession: string,
    idsDossier: string[]
  ): Promise<Result<InscrireJeuneSessionDto[]>> {
    return (await this.getClient()).inscrireJeunesSession(
      idpToken,
      idSession,
      idsDossier
    )
  }

  async desinscrireJeunesSession(
    idpToken: string,
    desinscriptions: Array<{ idDossier: string; idInstanceSession: string }>
  ): Promise<Result> {
    return (await this.getClient()).desinscrireJeunesSession(
      idpToken,
      desinscriptions
    )
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
    return (await this.getClient()).modifierInscriptionJeunesSession(
      idpToken,
      modifications
    )
  }

  async getInstanceSession(
    idInstance: string,
    idDossier: string
  ): Promise<Result<InstanceSessionMiloDto>> {
    return (await this.getClient()).getInstanceSession(idInstance, idDossier)
  }

  /* **************** */
  /* API UTILISATEURS */
  /* **************** */

  async getStructureConseiller(
    idpToken: string
  ): Promise<Result<StructureConseillerMiloDto>> {
    return (await this.getClient()).getStructureConseiller(idpToken)
  }

  /* ******* */
  /* API RDV */
  /* ******* */

  async getRendezVous(
    idDossier: string,
    idRendezVous: string
  ): Promise<Result<RendezVousMiloDto>> {
    return (await this.getClient()).getRendezVous(idDossier, idRendezVous)
  }

  /* *************** */
  /* API EVENEMENTS  */
  /* *************** */

  async getEvenements(): Promise<Result<EvenementMiloDto[]>> {
    return (await this.getClient()).getEvenements()
  }

  async acquitterEvenement(idEvenement: string): Promise<Result> {
    return (await this.getClient()).acquitterEvenement(idEvenement)
  }

  /* ******** */
  /* API MAIL */
  /********** */

  async envoyerEmailActivation(
    idpToken: string,
    email: string
  ): Promise<Result> {
    return (await this.getClient()).envoyerEmailActivation(idpToken, email)
  }

  private async avecCache<T>(
    cleCache: string,
    appel: () => Promise<Result<T>>
  ): Promise<Result<T>> {
    const resultat = await this.cacheApiPartenaire.executerAvecCache<T>({
      cleCache,
      appel: async () => {
        const result = await appel()
        if (isFailure(result)) throw new ErreurMiloNonRecuperable(result)
        return result.data
      },
      erreurEstRecuperable: erreur =>
        !(erreur instanceof ErreurMiloNonRecuperable)
    })

    switch (resultat.type) {
      case StatutResultatCache.FRAIS:
      case StatutResultatCache.CACHE:
        return success(resultat.data)
      case StatutResultatCache.ERREUR:
        if (resultat.erreur instanceof ErreurMiloNonRecuperable) {
          return resultat.erreur.failure
        }
        throw resultat.erreur
    }
  }

  private async getClient(): Promise<MiloClientPort> {
    let useV2 = this.apiV2Enabled && this.emailsConseillersV2?.length > 0

    const utilisateur = this.context.get<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )

    if (useV2 && utilisateur) {
      useV2 =
        this.estUnConseillerBetaTesteur(utilisateur) ||
        (await this.estUnJeuneBetaTesteur(utilisateur))
    } else {
      useV2 = false
    }

    return useV2 ? this.miloClientV2 : this.miloClientV1
  }

  private estUnConseillerBetaTesteur(
    utilisateur: Authentification.Utilisateur
  ): boolean {
    return (
      !!utilisateur.email &&
      utilisateur.type === Authentification.Type.CONSEILLER &&
      this.emailsConseillersV2.includes(utilisateur.email)
    )
  }

  private async estUnJeuneBetaTesteur(
    utilisateur: Authentification.Utilisateur
  ): Promise<boolean> {
    if (utilisateur.type !== Authentification.Type.JEUNE) return false
    if (!utilisateur.email) return false
    const emailConseillerDuJeuneRaw = await this.sequelize.query<{
      email: string
    }>(
      `SELECT c.email as email
       FROM jeune j
       JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
       WHERE j.id = (:idJeune)`,
      {
        replacements: { idJeune: utilisateur.id },
        type: QueryTypes.SELECT
      }
    )
    if (emailConseillerDuJeuneRaw.length !== 1) return false
    return this.emailsConseillersV2.includes(emailConseillerDuJeuneRaw[0].email)
  }
}

class ErreurMiloNonRecuperable extends Error {
  constructor(readonly failure: Failure) {
    super('Erreur Milo non récupérable (pas de repli cache)')
  }
}

function suffixePeriode(
  periode?: { debut?: DateTime; fin?: DateTime },
  timezone?: string
): string {
  const toJour = (date?: DateTime): string => {
    if (!date) return ''
    const dateZonee = timezone ? date.setZone(timezone) : date
    return dateZonee.toISODate() ?? ''
  }
  return `?debut=${toJour(periode?.debut)}&fin=${toJour(periode?.fin)}`
}

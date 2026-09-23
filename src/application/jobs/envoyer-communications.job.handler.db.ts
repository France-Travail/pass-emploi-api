import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { CommunicationEnvoi } from '../../domain/communication-envoi'
import {
  Notification,
  NotificationRepositoryToken
} from '../../domain/notification/notification'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'

// Empêche une communication_envoi de rester bloquée sur le statut EN_COURS indéfiniment
const MINUTES_AVANT_LIBERATION = 30
const ECHECS_CONSECUTIFS_MAX = 3

interface ResultatLot {
  idCommunication: number
  envoyees: number
  erreurs: number
  tokensInvalides: number
  restantes: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.ENVOYER_COMMUNICATIONS)
export class EnvoyerCommunicationsJobHandler extends JobHandler<void> {
  constructor(
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository,
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.ENVOYER_COMMUNICATIONS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { actif, tailleLot } =
      this.configService.get('jobs').envoiCommunications
    if (!actif) return this.rienAFaire(maintenant)

    const enCours = await this.communicationRepository.recupererEnvoiEnCours()
    if (enCours) {
      return this.envoyerUnLot(enCours, Number(tailleLot), maintenant)
    }

    const demarree =
      await this.communicationRepository.demarrerProchainEnvoi(maintenant)
    if (!demarree) return this.rienAFaire(maintenant)

    const compteurs = await this.communicationRepository.compterEnvois(
      demarree.id
    )
    rootLogger.info(
      {
        context: this.jobType,
        event: { action: 'communication_envoi_demarre', outcome: 'success' },
        communication: {
          id: demarree.id,
          idPopulation: demarree.idPopulation,
          nbDestinataires: compteurs.aEnvoyer
        }
      },
      'communication_envoi_demarre'
    )
    return this.suivi(maintenant, true, {
      idCommunication: demarree.id,
      nbDestinataires: compteurs.aEnvoyer
    })
  }

  private async envoyerUnLot(
    communication: Communication.AEnvoyer,
    tailleLot: number,
    maintenant: DateTime
  ): Promise<SuiviJob> {
    await this.communicationRepository.libererEnvoisBloques(
      communication.id,
      maintenant.minus({ minutes: MINUTES_AVANT_LIBERATION })
    )
    const reserves = await this.communicationRepository.reserverEnvois(
      communication.id,
      tailleLot,
      maintenant
    )
    if (reserves.length === 0) {
      return this.terminerSiPlusRien(communication, maintenant)
    }

    const { resultat, enErreur } = await this.envoyerAuxReserves(
      communication,
      reserves
    )
    const lotEntierEnErreur = enErreur.length === reserves.length
    await this.traiterLesEchecsDuLot(
      communication,
      enErreur,
      lotEntierEnErreur,
      maintenant
    )

    resultat.restantes = (
      await this.communicationRepository.compterEnvois(communication.id)
    ).aEnvoyer
    this.loguerLotEnvoye(communication.id, resultat, lotEntierEnErreur)
    return this.suivi(
      maintenant,
      !lotEntierEnErreur,
      resultat,
      resultat.erreurs
    )
  }

  // Envoie chaque réservation du lot et marque son statut, hors ERREUR : celles-ci
  // attendent le verdict du lot entier (traiterLesEchecsDuLot) avant d'être écrites.
  private async envoyerAuxReserves(
    communication: Communication.AEnvoyer,
    reserves: Array<{ idJeune: string; token: string | null }>
  ): Promise<{ resultat: ResultatLot; enErreur: string[] }> {
    const resultat: ResultatLot = {
      idCommunication: communication.id,
      envoyees: 0,
      erreurs: 0,
      tokensInvalides: 0,
      restantes: 0
    }
    const enErreur: string[] = []
    for (const { idJeune, token } of reserves) {
      const statut = await this.envoyer(communication, idJeune, token)
      if (statut === CommunicationEnvoi.Statut.ERREUR) {
        enErreur.push(idJeune)
      } else {
        await this.communicationRepository.marquerEnvoi(
          communication.id,
          idJeune,
          statut,
          this.dateService.now()
        )
      }
      if (statut === CommunicationEnvoi.Statut.ENVOYEE) resultat.envoyees++
      if (statut === CommunicationEnvoi.Statut.ERREUR) resultat.erreurs++
      if (statut === CommunicationEnvoi.Statut.TOKEN_INVALIDE)
        resultat.tokensInvalides++
    }
    return { resultat, enErreur }
  }

  // Lot entièrement en échec : probablement Firebase en panne, on rend les jeunes
  // à A_ENVOYER pour retry, et on arrête la communication après ECHECS_CONSECUTIFS_MAX
  // lots consécutifs. Échec partiel : erreurs isolées (token, jeune), on les marque
  // ERREUR définitivement et on repart de zéro sur le compteur d'échecs consécutifs.
  private async traiterLesEchecsDuLot(
    communication: Communication.AEnvoyer,
    enErreur: string[],
    lotEntierEnErreur: boolean,
    maintenant: DateTime
  ): Promise<void> {
    if (lotEntierEnErreur) {
      await this.communicationRepository.rendreEnvois(
        communication.id,
        enErreur
      )
      const echecs = await this.communicationRepository.enregistrerEchecDeLot(
        communication.id
      )
      if (echecs >= ECHECS_CONSECUTIFS_MAX) {
        await this.communicationRepository.terminerEnvoi(
          communication.id,
          Communication.StatutEnvoi.EN_ERREUR,
          maintenant
        )
        this.loguerTransition(
          communication.id,
          'communication_envoi_en_erreur',
          'failure'
        )
      }
      return
    }

    for (const idJeune of enErreur) {
      await this.communicationRepository.marquerEnvoi(
        communication.id,
        idJeune,
        CommunicationEnvoi.Statut.ERREUR,
        this.dateService.now()
      )
    }
    await this.communicationRepository.reinitialiserEchecsDeLot(
      communication.id
    )
  }

  private loguerLotEnvoye(
    idCommunication: number,
    resultat: ResultatLot,
    lotEntierEnErreur: boolean
  ): void {
    rootLogger[lotEntierEnErreur ? 'error' : 'info'](
      {
        context: this.jobType,
        event: {
          action: 'communication_lot_envoye',
          outcome: lotEntierEnErreur ? 'failure' : 'success'
        },
        communication: { id: idCommunication },
        lot: resultat
      },
      'communication_lot_envoye'
    )
  }

  private async envoyer(
    communication: Communication.AEnvoyer,
    idJeune: string,
    token: string | null
  ): Promise<CommunicationEnvoi.Statut> {
    if (communication.push && !token)
      return CommunicationEnvoi.Statut.TOKEN_INVALIDE
    try {
      const resultat = await this.notificationRepository.send(
        {
          token: token ?? '',
          notification: {
            title: communication.titre,
            body: communication.contenu
          },
          data: {
            // Absent, ce type ne redirige nulle part côté app.
            type:
              communication.typeNotification ??
              Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT
          }
        },
        idJeune,
        communication.push
      )
      return STATUT_PAR_RESULTAT[resultat]
    } catch (e) {
      rootLogger.error(
        {
          context: this.jobType,
          event: {
            action: 'communication_notification_envoyee',
            outcome: 'failure'
          },
          communication: { id: communication.id },
          jeune: { id: idJeune },
          error: toEcsError(e)
        },
        'communication_notification_envoyee'
      )
      return CommunicationEnvoi.Statut.ERREUR
    }
  }

  private async terminerSiPlusRien(
    communication: Communication.AEnvoyer,
    maintenant: DateTime
  ): Promise<SuiviJob> {
    const compteurs = await this.communicationRepository.compterEnvois(
      communication.id
    )
    if (compteurs.enCours > 0) return this.rienAFaire(maintenant)
    await this.communicationRepository.terminerEnvoi(
      communication.id,
      Communication.StatutEnvoi.ENVOYEE,
      maintenant
    )
    this.loguerTransition(
      communication.id,
      'communication_envoi_termine',
      'success'
    )
    return this.suivi(maintenant, true, {
      idCommunication: communication.id,
      ...compteurs
    })
  }

  private loguerTransition(
    idCommunication: number,
    action: string,
    outcome: 'success' | 'failure'
  ): void {
    rootLogger[outcome === 'success' ? 'info' : 'error'](
      {
        context: this.jobType,
        event: { action, outcome },
        communication: { id: idCommunication }
      },
      action
    )
  }

  private rienAFaire(maintenant: DateTime): SuiviJob {
    return { ...this.suivi(maintenant, true, undefined), silencieux: true }
  }

  private suivi(
    maintenant: DateTime,
    succes: boolean,
    resultat: unknown,
    nbErreurs = 0
  ): SuiviJob {
    return {
      jobType: this.jobType,
      dateExecution: maintenant,
      succes,
      resultat,
      nbErreurs,
      tempsExecution: DateService.calculerTempsExecution(maintenant)
    }
  }
}

const STATUT_PAR_RESULTAT: Record<
  Notification.ResultatEnvoi,
  CommunicationEnvoi.Statut
> = {
  [Notification.ResultatEnvoi.ENVOYEE]: CommunicationEnvoi.Statut.ENVOYEE,
  [Notification.ResultatEnvoi.TOKEN_INVALIDE]:
    CommunicationEnvoi.Statut.TOKEN_INVALIDE,
  [Notification.ResultatEnvoi.ERREUR]: CommunicationEnvoi.Statut.ERREUR
}

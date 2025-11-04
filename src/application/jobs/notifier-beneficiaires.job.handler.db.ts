import { Inject, Injectable } from '@nestjs/common'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Notification,
  NotificationRepositoryToken
} from '../../domain/notification/notification'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { JeuneSqlModel } from '../../infrastructure/sequelize/models/jeune.sql-model'
import { TIME_ZONE_EUROPE_PARIS } from '../../config/configuration'
import { DateTime, WeekdayNumbers } from 'luxon'
import StatsJobNotif = Planificateur.StatsJobNotif
import { Core } from '../../domain/core'
import { Op, WhereAttributeHash, WhereOptions } from 'sequelize'

const MS_ENTRE_CHAQUE_ENVOI_DE_NOTIF = 500
const TOKEN_NOT_NULL = {
  pushNotificationToken: {
    [Op.ne]: null
  }
}
@Injectable()
@ProcessJobType(Planificateur.JobType.NOTIFIER_BENEFICIAIRES)
export class NotifierBeneficiairesJobHandler extends JobHandler<Planificateur.JobNotifierBeneficiaires> {
  constructor(
    @Inject(NotificationRepositoryToken)
    private readonly notificationRepository: Notification.Repository,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(Planificateur.JobType.NOTIFIER_BENEFICIAIRES, suiviJobService)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobNotifierBeneficiaires>
  ): Promise<SuiviJob> {
    let succes = true
    const maintenant = this.dateService.now()
    const jobStats = job.contenu.stats
    const jobParams = job.contenu.params

    let taillePopulationTotale = jobStats?.taillePopulationTotale
    let nbBeneficiairesNotifiesOuErreur = jobStats?.nbBeneficiairesNotifies || 0
    const offset = jobStats?.offset || 0
    let estLaDerniereExecution = true

    try {
      const filtreRequete = this.construireFiltreRequete(jobParams.structures)
      let batchSize = jobParams.batchSize
      if (!taillePopulationTotale) {
        taillePopulationTotale = await JeuneSqlModel.count({
          where: filtreRequete
        })
      }
      if (!batchSize) {
        const unQuartDeLaPopulation = Math.trunc(0.25 * taillePopulationTotale)
        batchSize = Math.max(unQuartDeLaPopulation, 1)
      }

      const idsEtTokensBeneficiairesDuBatch = await JeuneSqlModel.findAll({
        where: filtreRequete,
        attributes: ['id', 'pushNotificationToken'],
        offset,
        limit: batchSize,
        order: [['id', 'ASC']]
      })

      nbBeneficiairesNotifiesOuErreur += idsEtTokensBeneficiairesDuBatch.length
      for (const idEtTokenBeneficiaire of idsEtTokensBeneficiairesDuBatch) {
        await this.envoyerLaNotification(idEtTokenBeneficiaire, job.contenu)
      }

      const ilResteDesBeneficiairesANotifier =
        nbBeneficiairesNotifiesOuErreur !== taillePopulationTotale

      if (ilResteDesBeneficiairesANotifier) {
        estLaDerniereExecution = false
        const stats: StatsJobNotif = {
          taillePopulationTotale: taillePopulationTotale,
          nbBeneficiairesNotifies: nbBeneficiairesNotifiesOuErreur,
          offset: offset + batchSize,
          estLaDerniereExecution: estLaDerniereExecution
        }
        this.planifierLeProchainJob(maintenant, job.contenu, stats, batchSize)
      }
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: 0,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {
        nbPopulationTotale: taillePopulationTotale,
        nbBeneficiairesNotifies: nbBeneficiairesNotifiesOuErreur,
        offset,
        estLaDerniereExecution: estLaDerniereExecution
      }
    }
  }

  private planifierLeProchainJob(
    maintenant: DateTime,
    contenuJob: Planificateur.JobNotifierBeneficiaires,
    stats: StatsJobNotif,
    batchSize: number
  ): void {
    let dateExecution = maintenant
      .plus({
        minute: contenuJob.params.minutesEntreLesBatchs
      })
      .setZone(TIME_ZONE_EUROPE_PARIS)

    dateExecution = this.reporterDateEnJourOuvreLaJournee(dateExecution)

    this.planificateurRepository.ajouterJob({
      dateExecution: dateExecution.toJSDate(),
      type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
      contenu: {
        ...contenuJob,
        stats,
        params: {
          ...contenuJob.params,
          batchSize
        }
      }
    })
  }

  private async envoyerLaNotification(
    idEtTokenBeneficiaire: JeuneSqlModel,
    contenuJob: Planificateur.JobNotifierBeneficiaires
  ): Promise<void> {
    try {
      const notification = {
        token: idEtTokenBeneficiaire.pushNotificationToken!,
        notification: {
          title: contenuJob.titre,
          body: contenuJob.description
        },
        data: {
          type: contenuJob.typeNotification
        }
      }
      await this.notificationRepository.send(
        notification,
        idEtTokenBeneficiaire.id,
        contenuJob.params.push
      )
    } catch (e) {
      this.logger.error(e)
    }
    await new Promise(resolve =>
      setTimeout(resolve, MS_ENTRE_CHAQUE_ENVOI_DE_NOTIF)
    )
  }

  private reporterDateEnJourOuvreLaJournee(date: DateTime): DateTime {
    const lundi = 1
    const samedi = 6

    const jour = date.localWeekday
    const prochainJourOuvre = (
      jour >= samedi ? lundi : jour + 1
    ) as WeekdayNumbers

    const huitHeures = { hour: 8, minute: 0, second: 0 }

    const prochainJourOuvre8h00 = {
      localWeekday: prochainJourOuvre,
      ...huitHeures
    }

    let newDate = date
    if (newDate.hour >= 17) {
      newDate = date.set(prochainJourOuvre8h00)
    }
    if (newDate.hour < 8) newDate = newDate.set(huitHeures)
    if (newDate.localWeekday >= samedi) {
      newDate = newDate.set(prochainJourOuvre8h00)
    }

    return newDate
  }

  private construireFiltreRequete(
    structures?: Core.Structure[]
  ): WhereAttributeHash<unknown> {
    const where: WhereOptions = TOKEN_NOT_NULL
    if (structures && structures.length > 0) {
      where.structure = { [Op.in]: structures }
    }
    return where
  }
}

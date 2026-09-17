import { Inject, Injectable } from '@nestjs/common'
import { Op } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { DateService } from '../../utils/date-service'
import { Communication } from '../../domain/communication'

const MINUTES_ENTRE_LES_BATCHS_DEFAUT = 5

interface Resultat {
  nbCommunicationsEnfilees: number
  idsCommunicationsEnfilees: number[]
  bloqueParUnJobEnCours: boolean
}

@Injectable()
@ProcessJobType(Planificateur.JobType.NOTIFIER_COMMUNICATIONS)
export class NotifierCommunicationsJobHandler extends JobHandler<void> {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository
  ) {
    super(Planificateur.JobType.NOTIFIER_COMMUNICATIONS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const resultat: Resultat = {
      nbCommunicationsEnfilees: 0,
      idsCommunicationsEnfilees: [],
      bloqueParUnJobEnCours: false
    }
    let succes = true

    try {
      const communicationsAEnvoyer = await CommunicationSqlModel.findAll({
        where: {
          type: Communication.Type.NOTIFICATION,
          dateDebut: { [Op.lte]: maintenant.toJSDate() },
          envoyeeLe: null
        },
        order: [['dateDebut', 'ASC']]
      })

      for (const communication of communicationsAEnvoyer) {
        const jobDejaEnCours =
          await this.planificateurRepository.recupererPremierJobNonTermine(
            Planificateur.JobType.NOTIFIER_BENEFICIAIRES
          )
        if (jobDejaEnCours !== null) {
          resultat.bloqueParUnJobEnCours = true
          break
        }

        const contenu: Planificateur.JobNotifierBeneficiaires = {
          typeNotification: communication.typeNotification!,
          titre: communication.titre,
          description: communication.contenu,
          params: {
            idPopulation: communication.idPopulation,
            push: true,
            minutesEntreLesBatchs: MINUTES_ENTRE_LES_BATCHS_DEFAUT
          }
        }
        await this.planificateurRepository.ajouterJob({
          dateExecution: maintenant.toJSDate(),
          type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
          contenu
        })
        await communication.update({ envoyeeLe: maintenant.toJSDate() })

        resultat.nbCommunicationsEnfilees++
        resultat.idsCommunicationsEnfilees.push(communication.id)
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
      resultat
    }
  }
}

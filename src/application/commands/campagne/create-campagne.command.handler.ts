import { Inject } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { CampagneExisteDejaError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Campagne, CampagneRepositoryToken } from '../../../domain/campagne'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { DateService } from '../../../utils/date-service'
import { TIME_ZONE_EUROPE_PARIS } from '../../../config/configuration'

export interface CreateCampagneCommand extends Command {
  nom: string
  dateDebut: DateTime
  dateFin: DateTime
}

export class CreateCampagneCommandHandler extends CommandHandler<
  CreateCampagneCommand,
  { id: string }
> {
  constructor(
    @Inject(CampagneRepositoryToken)
    private campagneRepository: Campagne.Repository,
    private campagneFactory: Campagne.Factory,
    @Inject(PlanificateurRepositoryToken)
    private planificateurRepository: Planificateur.Repository,
    private dateService: DateService
  ) {
    super('CreateCampagneCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(
    command: CreateCampagneCommand
  ): Promise<Result<{ id: string }>> {
    const campagneExistanteSurLIntervalleOuLeNom =
      await this.campagneRepository.getByIntervalOrName(
        command.dateDebut,
        command.dateFin,
        command.nom
      )

    if (campagneExistanteSurLIntervalleOuLeNom) {
      return failure(new CampagneExisteDejaError())
    }

    const campagne = this.campagneFactory.creer(command)
    await this.campagneRepository.save(campagne)

    const maintenant = this.dateService.now()
    const heure = maintenant.hour
    const jour = maintenant.weekday

    const jeudi = 4
    const heureDExecution = 11
    const heureMinuteExecution = {
      hour: heureDExecution,
      minute: 40,
      second: 0,
      millisecond: 0
    }
    let dateExecution = maintenant
      .plus({ days: 1 })
      .setZone(TIME_ZONE_EUROPE_PARIS)
      .set(heureMinuteExecution)

    if (heure <= heureDExecution && jour !== jeudi) {
      dateExecution = maintenant
        .setZone(TIME_ZONE_EUROPE_PARIS)
        .set(heureMinuteExecution)
    }

    await this.planificateurRepository.ajouterJob({
      dateExecution: dateExecution.toJSDate(),
      type: Planificateur.JobType.NOTIFIER_CAMPAGNE,
      contenu: {
        offset: 0,
        idCampagne: campagne.id,
        nbNotifsEnvoyees: 0
      }
    })

    if (command.dateFin.diff(this.dateService.now()).as('days') > 7) {
      let rappel = maintenant.plus({ days: 7 }).setZone(TIME_ZONE_EUROPE_PARIS)
      if (rappel.weekday === jeudi) {
        rappel = maintenant.plus({ days: 8 }).setZone(TIME_ZONE_EUROPE_PARIS)
      }
      await this.planificateurRepository.ajouterJob({
        dateExecution: rappel.set(heureMinuteExecution).toJSDate(),
        type: Planificateur.JobType.NOTIFIER_CAMPAGNE,
        contenu: {
          offset: 0,
          idCampagne: campagne.id,
          nbNotifsEnvoyees: 0
        }
      })
    }

    return success({ id: campagne.id })
  }

  async monitor(): Promise<void> {
    return
  }
}

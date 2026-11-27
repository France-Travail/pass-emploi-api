import { Inject, Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { MauvaiseCommandeError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result,
  success
} from '../../../building-blocks/types/result'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../../domain/archive-jeune'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { DateService } from '../../../utils/date-service'
import { DesarchivageJeuneService } from './desarchivage-jeune.service.db'

export interface DesarchiverJeunesConseillerCommand extends Command {
  emailConseiller: string
}

export class DesarchivageJeunesConseillerQueryModel {
  @ApiProperty({ description: 'Conseiller dont les archives sont restaurées' })
  idConseiller: string
}

@Injectable()
export class DesarchiverJeunesConseillerCommandHandler extends CommandHandler<
  DesarchiverJeunesConseillerCommand,
  DesarchivageJeunesConseillerQueryModel
> {
  constructor(
    private readonly desarchivageService: DesarchivageJeuneService,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('DesarchiverJeunesConseillerCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: DesarchiverJeunesConseillerCommand
  ): Promise<Result<DesarchivageJeunesConseillerQueryModel>> {
    const conseillerResult = await this.desarchivageService.trouverLeConseiller(
      command.emailConseiller
    )
    if (isFailure(conseillerResult)) {
      return conseillerResult
    }
    const idConseiller = conseillerResult.data

    const [premiereArchive] =
      await this.archiveJeuneRepository.idsArchivesMigrationDuConseiller({
        idConseiller,
        taille: 1
      })
    if (premiereArchive === undefined) {
      return failure(
        new MauvaiseCommandeError(
          `Aucune archive au motif Migration pour le conseiller ${idConseiller}`
        )
      )
    }

    if (
      await this.planificateurRepository.chaineDeLotsEnCours(
        Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER
      )
    ) {
      return failure(
        new MauvaiseCommandeError(
          'Un désarchivage en masse est déjà en cours : attendre sa fin avant d’en relancer un'
        )
      )
    }

    await this.planificateurRepository.ajouterJob<Planificateur.JobDesarchiverJeunesConseiller>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.DESARCHIVER_JEUNES_CONSEILLER,
        contenu: { idConseiller }
      }
    )
    return success({ idConseiller })
  }
}

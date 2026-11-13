import { Inject, Injectable } from '@nestjs/common'
import {
  BilanLot,
  JobParLotsHandler
} from '../../building-blocks/types/job-par-lots-handler'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import {
  Planificateur,
  PlanificateurRepositoryToken,
  ProcessJobType
} from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'

export const TAILLE_LOT_DECONNEXION_DISPOSITIF = 100

@Injectable()
@ProcessJobType(Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF)
export class DeconnecterJeunesDispositifJobHandler extends JobParLotsHandler<Planificateur.JobDeconnecterJeunesDispositif> {
  protected readonly tailleLot = TAILLE_LOT_DECONNEXION_DISPOSITIF

  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    dateService: DateService,
    @Inject(PlanificateurRepositoryToken)
    planificateurRepository: Planificateur.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository
  ) {
    super(
      Planificateur.JobType.DECONNECTER_JEUNES_DISPOSITIF,
      suiviJobService,
      planificateurRepository,
      dateService
    )
  }

  protected recupererLot(
    contenu: Planificateur.JobDeconnecterJeunesDispositif,
    taille: number
  ): Promise<string[]> {
    return this.jeuneRepository.recupererIdsAuthentificationDuDispositif(
      contenu.dispositif,
      taille,
      contenu.apresId
    )
  }

  protected async traiterLot(
    contenu: Planificateur.JobDeconnecterJeunesDispositif,
    idsAuthentification: string[]
  ): Promise<BilanLot> {
    try {
      await this.authentificationRepository.revoquerTokensIdp(
        idsAuthentification
      )
      return { nbTraites: idsAuthentification.length, nbEchecs: 0 }
    } catch (e) {
      rootLogger.error(
        {
          context: this.jobType,
          labels: { dispositif: contenu.dispositif },
          error: toEcsError(e)
        },
        "Échec de la déconnexion d'un lot de jeunes du dispositif"
      )
      return { nbTraites: 0, nbEchecs: idsAuthentification.length }
    }
  }
}

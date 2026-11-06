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

// Chaque déconnexion parcourt tout le Redis de connect (KEYS, bloquant) : un
// appel à la fois, avec une pause, pour lui laisser servir les autres requêtes.
export const PAUSE_ENTRE_DECONNEXIONS_MS = 100

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
    let nbEchecs = 0
    for (const idAuthentification of idsAuthentification) {
      try {
        await this.authentificationRepository.supprimerCompteIdp(
          idAuthentification
        )
      } catch (e) {
        nbEchecs++
        rootLogger.error(
          {
            context: this.jobType,
            labels: { dispositif: contenu.dispositif },
            error: toEcsError(e)
          },
          "Échec de la déconnexion d'un jeune du dispositif"
        )
      }
      await this.dateService.attendre(PAUSE_ENTRE_DECONNEXIONS_MS)
    }
    return { nbTraites: idsAuthentification.length - nbEchecs, nbEchecs }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'
import { rootLogger, toEcsError } from '../../utils/logger.module'

interface ResultatPurge {
  nbPurges: number
  nbEchecsIdp: number
  nbEchecsDb: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.PURGER_INVITES_INACTIFS)
export class PurgerInvitesInactifsJobHandler extends JobHandler {
  constructor(
    private dateService: DateService,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.PURGER_INVITES_INACTIFS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const { retentionJours, pourcentageInactifsMax } =
      this.configService.get('jobs').purgeInvites

    const dateSeuil = maintenant
      .minus({ days: Number(retentionJours) })
      .toJSDate()

    let nbErreurs = 0
    let pourcentageInactifs = 0
    let total = 0
    let nombreInactifs = 0
    let resultatPurge: ResultatPurge = {
      nbPurges: 0,
      nbEchecsIdp: 0,
      nbEchecsDb: 0
    }

    try {
      const [totalInvites, candidats] = await Promise.all([
        this.jeuneInviteRepository.compterTout(),
        this.jeuneInviteRepository.recupererInvitesInactifs(dateSeuil)
      ])
      total = totalInvites
      nombreInactifs = candidats.length
      pourcentageInactifs = total > 0 ? (nombreInactifs / total) * 100 : 0

      if (pourcentageInactifs > Number(pourcentageInactifsMax)) {
        rootLogger.error(
          {
            context: 'PurgerInvitesInactifsJobHandler',
            event: {
              action: 'purge_invites_abandonnee',
              outcome: 'failure'
            },
            labels: {
              pourcentage_inactifs: pourcentageInactifs.toFixed(1),
              seuil: String(pourcentageInactifsMax)
            }
          },
          'purge_invites_abandonnee'
        )
        nbErreurs++
      } else {
        resultatPurge = await this.purger(candidats)
        nbErreurs += resultatPurge.nbEchecsIdp + resultatPurge.nbEchecsDb
      }
    } catch (e) {
      this.logger.error(
        'Echec du job de purge des invités inactifs',
        toEcsError(e).stack_trace
      )
      nbErreurs++
    }

    return {
      jobType: this.jobType,
      nbErreurs,
      succes: nbErreurs === 0,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {
        ...resultatPurge,
        pourcentageInactifs,
        nombreInactifs,
        total
      }
    }
  }

  private async purger(
    candidats: Array<{ id: string; idAuthentification: string }>
  ): Promise<ResultatPurge> {
    const idsSupprimesCoteIdp: string[] = []
    let nbEchecsIdp = 0

    for (const invite of candidats) {
      try {
        await this.authentificationRepository.supprimerCompteIdpInvite(
          invite.idAuthentification
        )
        idsSupprimesCoteIdp.push(invite.id)
      } catch (e) {
        this.logger.error(
          `Echec suppression IDP invité ${invite.idAuthentification}`,
          toEcsError(e).stack_trace
        )
        nbEchecsIdp++
      }
    }

    if (idsSupprimesCoteIdp.length === 0) {
      return { nbPurges: 0, nbEchecsIdp, nbEchecsDb: 0 }
    }

    try {
      await this.jeuneInviteRepository.supprimerPlusieurs(idsSupprimesCoteIdp)
      return {
        nbPurges: idsSupprimesCoteIdp.length,
        nbEchecsIdp,
        nbEchecsDb: 0
      }
    } catch (e) {
      this.logger.error(
        'Echec suppression DB en masse des invités purgés côté IDP',
        toEcsError(e).stack_trace
      )
      return {
        nbPurges: 0,
        nbEchecsIdp,
        nbEchecsDb: idsSupprimesCoteIdp.length
      }
    }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
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
    const config = this.configService.get('jobs').purgeInvites
    const retentionMois = Number(config.retentionMois)
    const batchMax = Number(config.batchMax)
    const pourcentageParcMax = Number(config.pourcentageParcMax)
    const dryRun: boolean = config.dryRun
    const delaiMs = Number(config.delaiEntreSuppressionsMs)

    const dateSeuil = maintenant.minus({ months: retentionMois }).toJSDate()

    let nbErreurs = 0
    let nbPurges = 0
    let nbSimules = 0
    let nbEchecsRedis = 0
    let nbEchecsDb = 0
    let ageMinJours: number | null = null
    let ageMaxJours: number | null = null
    let pourcentageParc = 0
    let succes = true

    try {
      const total = await this.jeuneInviteRepository.compterTout()
      const nombreInactifs =
        await this.jeuneInviteRepository.compterInvitesInactifs(dateSeuil)
      const candidats =
        await this.jeuneInviteRepository.recupererInvitesInactifs(
          dateSeuil,
          batchMax
        )

      pourcentageParc = total > 0 ? (nombreInactifs / total) * 100 : 0

      if (pourcentageParc > pourcentageParcMax) {
        this.logger.warn(
          `Purge invités abandonnée: ${pourcentageParc.toFixed(
            1
          )}% du parc dépasse le seuil ${pourcentageParcMax}%`
        )
        return {
          jobType: this.jobType,
          nbErreurs: 1,
          succes: false,
          dateExecution: maintenant,
          tempsExecution: DateService.calculerTempsExecution(maintenant),
          resultat: {
            dryRun,
            nbPurges: 0,
            nbSimules: 0,
            nbEchecsRedis: 0,
            nbEchecsDb: 0,
            pourcentageParc,
            ageMinJours: null,
            ageMaxJours: null,
            abandon: true,
            nbCandidats: candidats.length,
            total
          }
        }
      }

      const agesJours = candidats.map(invite =>
        Math.floor(
          maintenant.diff(DateTime.fromJSDate(invite.dateReference), 'days')
            .days
        )
      )
      if (agesJours.length > 0) {
        ageMinJours = Math.min(...agesJours)
        ageMaxJours = Math.max(...agesJours)
      }

      for (const invite of candidats) {
        if (dryRun) {
          nbSimules++
          continue
        }
        try {
          await this.authentificationRepository.supprimerCompteIdpInvite(
            invite.idAuthentification
          )
        } catch (e) {
          this.logger.warn(
            `Echec suppression IDP invité ${invite.idAuthentification}`,
            e
          )
          nbEchecsRedis++
          continue
        }
        try {
          await this.jeuneInviteRepository.supprimer(invite.id)
          nbPurges++
        } catch (e) {
          this.logger.warn(`Echec suppression DB invité ${invite.id}`, e)
          nbEchecsDb++
        }
        await this.pause(delaiMs)
      }
    } catch (e) {
      this.logger.warn('Echec du job de purge des invités inactifs', e)
      nbErreurs++
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {
        dryRun,
        nbPurges,
        nbSimules,
        nbEchecsRedis,
        nbEchecsDb,
        pourcentageParc,
        ageMinJours,
        ageMaxJours
      }
    }
  }

  private async pause(ms: number): Promise<void> {
    if (ms > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, ms))
    }
  }
}

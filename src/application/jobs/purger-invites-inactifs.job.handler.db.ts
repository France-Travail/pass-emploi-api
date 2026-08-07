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

const FENETRE_CONTROLE_SIGNAL_HEURES = 24

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
    const retentionJours = Number(config.retentionJours)
    const pourcentageInactifsMax = Number(config.pourcentageInactifsMax)
    const dryRun: boolean = config.dryRun
    const delaiMs = Number(config.delaiEntreSuppressionsMs)
    const parcMinimalControleSignal = Number(config.parcMinimalControleSignal)

    const dateSeuil = maintenant.minus({ days: retentionJours }).toJSDate()

    let nbErreurs = 0
    let nbPurges = 0
    let nbSimules = 0
    let nbEchecsRedis = 0
    let nbEchecsDb = 0
    let plusCourteInactiviteJours: number | null = null
    let pourcentageInactifs = 0
    let succes = true
    let motifAbandon: 'SIGNAL_MUET' | 'INVARIANT_AGE' | null = null
    let alerteBacklog = false
    let total = 0
    let nombreInactifs = 0
    let activiteRecente = false

    try {
      total = await this.jeuneInviteRepository.compterTout()
      const candidats =
        await this.jeuneInviteRepository.recupererInvitesInactifs(dateSeuil)
      nombreInactifs = candidats.length

      activiteRecente = await this.jeuneInviteRepository.existeActiviteDepuis(
        maintenant.minus({ hours: FENETRE_CONTROLE_SIGNAL_HEURES }).toJSDate()
      )

      pourcentageInactifs = total > 0 ? (nombreInactifs / total) * 100 : 0

      if (pourcentageInactifs > pourcentageInactifsMax) {
        alerteBacklog = true
        this.logger.warn(
          `Purge invités: ${pourcentageInactifs.toFixed(
            1
          )}% du parc est inactif, au-dessus du seuil ${pourcentageInactifsMax}%`
        )
      }

      for (const invite of candidats) {
        const ageJours = Math.floor(
          maintenant.diff(DateTime.fromJSDate(invite.dateReference), 'days')
            .days
        )
        if (
          plusCourteInactiviteJours === null ||
          ageJours < plusCourteInactiviteJours
        ) {
          plusCourteInactiviteJours = ageJours
        }
      }

      if (!activiteRecente && total >= parcMinimalControleSignal) {
        motifAbandon = 'SIGNAL_MUET'
        this.logger.error(
          `Purge invités abandonnée: aucune activité invité enregistrée depuis ` +
            `${FENETRE_CONTROLE_SIGNAL_HEURES}h sur un parc de ${total}, ` +
            "le signal d'activité est probablement cassé"
        )
        succes = false
        nbErreurs += 1
      } else if (
        plusCourteInactiviteJours !== null &&
        plusCourteInactiviteJours < retentionJours
      ) {
        motifAbandon = 'INVARIANT_AGE'
        this.logger.error(
          `Purge invités abandonnée: un candidat a ${plusCourteInactiviteJours} jours d'inactivité, ` +
            `sous la rétention de ${retentionJours} jours`
        )
        succes = false
        nbErreurs += 1
      } else {
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
            await this.pause(delaiMs)
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

        nbErreurs += nbEchecsRedis + nbEchecsDb
        if (nbEchecsRedis > 0 || nbEchecsDb > 0) {
          succes = false
        }
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
        pourcentageInactifs,
        plusCourteInactiviteJours,
        motifAbandon,
        activiteRecente,
        alerteBacklog,
        nombreInactifs,
        total
      }
    }
  }

  private async pause(ms: number): Promise<void> {
    if (ms > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, ms))
    }
  }
}

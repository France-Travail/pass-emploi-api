import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Sequelize } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { Profil } from '../../domain/profil'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { AgenceFTDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from '../../infrastructure/sequelize/models/agence.sql-model'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { rootLogger } from '../../utils/logger.module'
import { DateService } from '../../utils/date-service'
import {
  chargerDepartementParCommune,
  chargerLibelleParCodeRegion,
  normaliserDepartement,
  normaliserNomAgence,
  pousser
} from './agences-ft.helpers'
import { CORRESPONDANCES_AGENCES_FT } from './data/correspondances-agences-ft'

export interface StatsReconciliationAgencesFT {
  dryRun: boolean
  nbAppariees: number
  nbAmbigues: number
  nbOrphelinesFT: number
  nbOrphelinesBase: number
  nbMisesAJour: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.RECONCILIER_AGENCES_FT)
export class ReconcilierAgencesFTJobHandler extends JobHandler<void> {
  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.RECONCILIER_AGENCES_FT, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').reconciliationAgencesFT
    const stats: StatsReconciliationAgencesFT = {
      dryRun: config.dryRun,
      nbAppariees: 0,
      nbAmbigues: 0,
      nbOrphelinesFT: 0,
      nbOrphelinesBase: 0,
      nbMisesAJour: 0
    }
    let succes = true

    try {
      const agencesFTResult = await this.poleEmploiClient.getAgencesFT()
      if (isFailure(agencesFTResult)) {
        throw new Error(
          `Récupération des agences FT échouée : ${agencesFTResult.error.message}`
        )
      }
      const agencesFT = agencesFTResult.data
      if (agencesFT.length === 0) {
        throw new Error('Le référentiel des agences FT est vide')
      }

      const agencesBase = await AgenceSqlModel.findAll({
        where: { structure: Profil.Structure.FRANCE_TRAVAIL }
      })

      await this.reconcilier(agencesFT, agencesBase, stats, config.dryRun)
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: succes ? 0 : 1,
      succes,
      dateExecution: debutExecutionJob,
      tempsExecution: DateService.calculerTempsExecution(debutExecutionJob),
      resultat: stats
    }
  }

  private async reconcilier(
    agencesFT: AgenceFTDto[],
    agencesBase: AgenceSqlModel[],
    stats: StatsReconciliationAgencesFT,
    dryRun: boolean
  ): Promise<void> {
    const departementParCommune = await chargerDepartementParCommune(agencesFT)

    const parNomEtDepartement = new Map<string, AgenceSqlModel[]>()
    const parNom = new Map<string, AgenceSqlModel[]>()
    for (const agence of agencesBase) {
      const nom = normaliserNomAgence(agence.nomAgence)
      pousser(parNom, nom, agence)
      pousser(
        parNomEtDepartement,
        `${nom}|${normaliserDepartement(agence.codeDepartement)}`,
        agence
      )
    }

    const appariements: Array<{
      ft: AgenceFTDto
      base: AgenceSqlModel
      viaCorrespondance: boolean
    }> = []
    const apparieesBase = new Set<string>()
    const ftOrphelines: AgenceFTDto[] = []

    for (const agenceFT of agencesFT) {
      const nom = normaliserNomAgence(agenceFT.libelle)
      const departement = normaliserDepartement(
        departementParCommune.get(
          agenceFT.adressePrincipale.communeImplantation
        )
      )
      const candidats =
        parNomEtDepartement.get(`${nom}|${departement}`) ??
        parNom.get(nom) ??
        []

      if (candidats.length === 1) {
        appariements.push({
          ft: agenceFT,
          base: candidats[0],
          viaCorrespondance: false
        })
        apparieesBase.add(candidats[0].id)
      } else if (candidats.length > 1) {
        stats.nbAmbigues++
      } else {
        ftOrphelines.push(agenceFT)
      }
    }

    const parCodeSafirFTOrpheline = new Map(
      ftOrphelines.map(ft => [ft.codeSafir, ft])
    )
    for (const agence of agencesBase) {
      if (apparieesBase.has(agence.id)) continue
      const codeSafirCible = CORRESPONDANCES_AGENCES_FT[agence.id]
      if (!codeSafirCible) continue
      const ft = parCodeSafirFTOrpheline.get(codeSafirCible)
      if (!ft) continue

      appariements.push({ ft, base: agence, viaCorrespondance: true })
      apparieesBase.add(agence.id)
      parCodeSafirFTOrpheline.delete(codeSafirCible)
    }

    stats.nbAppariees = appariements.length
    stats.nbOrphelinesFT = parCodeSafirFTOrpheline.size
    stats.nbOrphelinesBase = agencesBase.filter(
      a => !apparieesBase.has(a.id)
    ).length

    if (dryRun) return

    const libelleParCodeRegion = await chargerLibelleParCodeRegion()

    await this.sequelize.transaction(async transaction => {
      for (const { ft, base, viaCorrespondance } of appariements) {
        if (viaCorrespondance) {
          rootLogger.info(
            {
              context: this.jobType,
              event: { action: 'agence_ft_renommee', outcome: 'success' },
              agence: { id: base.id, nom: base.nomAgence },
              codeSafirCible: ft.codeSafir
            },
            'agence_ft_renommee'
          )
        }
        await AgenceSqlModel.update(
          {
            codeSafir: ft.codeSafir,
            nomAgence: ft.libelleEtendu,
            codeRegion: ft.codeRegionINSEE ?? base.codeRegion,
            nomRegion: ft.codeRegionINSEE
              ? (libelleParCodeRegion.get(ft.codeRegionINSEE) ?? base.nomRegion)
              : base.nomRegion
          },
          { where: { id: base.id }, transaction }
        )
        stats.nbMisesAJour++
      }
    })
  }
}

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
import { ConseillerSqlModel } from '../../infrastructure/sequelize/models/conseiller.sql-model'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { DateService } from '../../utils/date-service'
import { rootLogger } from '../../utils/logger.module'
import { CORRESPONDANCES_AGENCES_FT } from './data/correspondances-agences-ft'
import {
  chargerDepartementParCommune,
  chargerLibelleParCodeRegion,
  chargerRegionParDepartement
} from './agences-ft.helpers'

export interface StatsMajAgencesFT {
  dryRun: boolean
  nbCreees: number
  nbMisesAJour: number
  nbSupprimees: number
  nbConseillersDetaches: number
  nbConseillersReaffectes: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT)
export class MajReferentielAgencesFTJobHandler extends JobHandler<void> {
  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').majAgencesFT
    const stats: StatsMajAgencesFT = {
      dryRun: config.dryRun,
      nbCreees: 0,
      nbMisesAJour: 0,
      nbSupprimees: 0,
      nbConseillersDetaches: 0,
      nbConseillersReaffectes: 0
    }
    let succes = true

    try {
      const agencesBase = await AgenceSqlModel.findAll({
        where: { structure: Profil.Structure.FRANCE_TRAVAIL }
      })

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

      await this.appliquerDiff(agencesFT, agencesBase, stats, config)
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

  private async appliquerDiff(
    agencesFT: AgenceFTDto[],
    agencesBase: AgenceSqlModel[],
    stats: StatsMajAgencesFT,
    config: {
      pourcentageSuppressionsMax: string
      nombreSuppressionsMin: string
      dryRun: boolean
    }
  ): Promise<void> {
    const departementParCommune = await chargerDepartementParCommune(agencesFT)
    const libelleParCodeRegion = await chargerLibelleParCodeRegion()
    const departementParCodeRegion = await chargerRegionParDepartement()

    const parCodeSafir = new Map(agencesBase.map(a => [a.codeSafir, a]))
    const codesSafirFT = new Set(agencesFT.map(a => a.codeSafir))

    const aSupprimer = agencesBase.filter(
      a => !a.codeSafir || !codesSafirFT.has(a.codeSafir)
    )
    const plafond = Math.max(
      parseInt(config.nombreSuppressionsMin, 10),
      Math.floor(
        (agencesBase.length * parseInt(config.pourcentageSuppressionsMax, 10)) /
          100
      )
    )
    if (aSupprimer.length > plafond) {
      throw new Error(
        `Plafond de suppressions dépassé : ${aSupprimer.length} > ${plafond}`
      )
    }

    const idParCodeSafir = new Map<string, string>()
    for (const agenceFT of agencesFT) {
      const existante = parCodeSafir.get(agenceFT.codeSafir)
      idParCodeSafir.set(
        agenceFT.codeSafir,
        existante?.id ?? agenceFT.codeSafir
      )
      if (existante) stats.nbMisesAJour++
      else stats.nbCreees++
    }

    const idCibleParAgence = new Map<string, string | null>()
    const nbConseillersParAgence = new Map<string, number>()
    for (const agence of aSupprimer) {
      const codeSafirCible = CORRESPONDANCES_AGENCES_FT[agence.id]
      const idCible = codeSafirCible
        ? (idParCodeSafir.get(codeSafirCible) ?? null)
        : null
      idCibleParAgence.set(agence.id, idCible)

      const nbConseillers = await ConseillerSqlModel.count({
        where: { idAgence: agence.id }
      })
      nbConseillersParAgence.set(agence.id, nbConseillers)
      if (idCible) stats.nbConseillersReaffectes += nbConseillers
      else stats.nbConseillersDetaches += nbConseillers
    }
    stats.nbSupprimees = aSupprimer.length

    if (config.dryRun) return

    await this.sequelize.transaction(async transaction => {
      for (const agenceFT of agencesFT) {
        const codeDepartement =
          departementParCommune.get(
            agenceFT.adressePrincipale.communeImplantation
          ) ?? null
        const codeRegion =
          agenceFT.codeRegionINSEE ??
          (codeDepartement
            ? (departementParCodeRegion.get(codeDepartement) ?? null)
            : null)
        const nomRegion = codeRegion
          ? (libelleParCodeRegion.get(codeRegion) ?? 'INCONNU')
          : 'INCONNU'

        const existante = parCodeSafir.get(agenceFT.codeSafir)
        if (existante) {
          await AgenceSqlModel.update(
            {
              nomAgence: agenceFT.libelleEtendu,
              codeRegion,
              nomRegion,
              codeDepartement: codeDepartement ?? existante.codeDepartement
            },
            { where: { id: existante.id }, transaction }
          )
        } else {
          await AgenceSqlModel.create(
            {
              id: agenceFT.codeSafir,
              codeSafir: agenceFT.codeSafir,
              nomAgence: agenceFT.libelleEtendu,
              nomUsuel: agenceFT.libelle,
              nomRegion,
              codeRegion,
              nomDepartement: null,
              codeDepartement: codeDepartement ?? '99',
              structure: Profil.Structure.FRANCE_TRAVAIL,
              timezone: 'Europe/Paris'
            },
            { transaction }
          )
        }
      }

      for (const agence of aSupprimer) {
        const idCible = idCibleParAgence.get(agence.id) ?? null
        const nbConseillers = nbConseillersParAgence.get(agence.id) ?? 0

        await ConseillerSqlModel.update(
          { idAgence: idCible },
          { where: { idAgence: agence.id }, transaction }
        )

        const action = idCible ? 'agence_ft_fusionnee' : 'agence_ft_supprimee'
        rootLogger.info(
          {
            context: this.jobType,
            event: { action, outcome: 'success' },
            agence: { id: agence.id, nom: agence.nomAgence, idCible },
            nbConseillers
          },
          action
        )

        await AgenceSqlModel.destroy({
          where: { id: agence.id },
          transaction
        })
      }
    })
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { remove as enleverLesAccents } from 'remove-accents'
import { Sequelize } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { MetierRomeSqlModel } from '../../infrastructure/sequelize/models/metier-rome.sql-model'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { DateService } from '../../utils/date-service'

interface Stats {
  nbMetiersMaj: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.MAJ_REFERENTIEL_ROME)
export class MajReferentielRomeJobHandler extends JobHandler<void> {
  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService
  ) {
    super(Planificateur.JobType.MAJ_REFERENTIEL_ROME, suiviJobService)
  }

  async handle(_job: Planificateur.Job<void>): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const stats: Stats = { nbMetiersMaj: 0 }
    let succes = true

    try {
      const [appellationsResult, metiersResult] = await Promise.all([
        this.poleEmploiClient.getAppellationsRome(),
        this.poleEmploiClient.getMetiersRomeApi()
      ])

      if (isFailure(appellationsResult)) {
        throw new Error(
          `Récupération appellations ROME échouée : ${appellationsResult.error.message}`
        )
      }
      if (isFailure(metiersResult)) {
        throw new Error(
          `Récupération métiers ROME échouée : ${metiersResult.error.message}`
        )
      }

      const appellations = appellationsResult.data
      const metiers = metiersResult.data

      const appellationsByLibelle = new Map(
        appellations.map(a => [a.libelle, a])
      )

      const entries: Array<{
        code: string
        libelle: string
        libelleSanitized: string
        appellationCode: string | null
      }> = []

      for (const metier of metiers) {
        const matchingAppellation = appellationsByLibelle.get(metier.libelle)
        entries.push({
          code: metier.code,
          libelle: metier.libelle,
          libelleSanitized: enleverLesAccents(metier.libelle),
          appellationCode: matchingAppellation?.code ?? null
        })
        if (matchingAppellation) {
          appellationsByLibelle.delete(metier.libelle)
        }
      }

      for (const appellation of appellationsByLibelle.values()) {
        entries.push({
          code: appellation.code,
          libelle: appellation.libelle,
          libelleSanitized: enleverLesAccents(appellation.libelle),
          appellationCode: appellation.code
        })
      }

      await this.sequelize.transaction(async t => {
        await MetierRomeSqlModel.destroy({ truncate: true, transaction: t })
        await MetierRomeSqlModel.bulkCreate(
          entries.map((entry, index) => ({
            id: index + 1,
            code: entry.code,
            libelle: entry.libelle,
            libelleSanitized: entry.libelleSanitized,
            appellationCode: entry.appellationCode
          })),
          { transaction: t }
        )
      })

      stats.nbMetiersMaj = entries.length
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
}

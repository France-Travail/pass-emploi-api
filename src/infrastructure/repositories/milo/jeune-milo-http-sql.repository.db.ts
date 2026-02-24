import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Op } from 'sequelize'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneMiloAArchiverSqlModel } from 'src/infrastructure/sequelize/models/jeune-milo-a-archiver.sql-model'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Core } from '../../../domain/core'
import { JeuneMilo } from '../../../domain/milo/jeune.milo'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'
import { SituationsMiloSqlModel } from '../../sequelize/models/situations-milo.sql-model'
import { StructureMiloSqlModel } from '../../sequelize/models/structure-milo.sql-model'
import { fromSqlToJeune } from '../mappers/jeunes.mappers'
import { MiloClient } from '../../clients/milo/milo-client'

@Injectable()
export class MiloJeuneHttpSqlRepository implements JeuneMilo.Repository {
  constructor(private readonly miloClient: MiloClient) {}

  async getDossier(idDossier: string): Promise<Result<JeuneMilo.Dossier>> {
    return this.miloClient.getDossier(idDossier)
  }

  async get(id: string): Promise<Result<JeuneMilo>> {
    const jeuneSqlModel = await JeuneSqlModel.findOne({
      where: { id, structure: Core.Structure.MILO },
      include: { model: ConseillerSqlModel, required: false }
    })
    if (!jeuneSqlModel) {
      return failure(new NonTrouveError('Jeune', id))
    }

    const jeuneMilo: JeuneMilo = {
      ...fromSqlToJeune(jeuneSqlModel),
      idStructureMilo: jeuneSqlModel.idStructureMilo ?? undefined
    }
    return success(jeuneMilo)
  }

  async getByIdDossier(
    idDossier: string,
    options?: { includeConseiller: boolean }
  ): Promise<Result<JeuneMilo>> {
    const jeuneSqlModel = await JeuneSqlModel.findOne({
      where: { idPartenaire: idDossier },
      ...(options?.includeConseiller && { include: [ConseillerSqlModel] })
    })
    if (!jeuneSqlModel) {
      return failure(new NonTrouveError('Dossier Milo', idDossier))
    }
    const jeuneMilo: JeuneMilo = {
      ...fromSqlToJeune(jeuneSqlModel),
      idStructureMilo: jeuneSqlModel.idStructureMilo ?? undefined
    }
    return success(jeuneMilo)
  }

  async creerJeune(
    idDossier: string,
    idpToken: string,
    surcharge?: boolean
  ): Promise<
    Result<{ idAuthentification?: string; existeDejaChezMilo: boolean }>
  > {
    return this.miloClient.creerJeune(idDossier, idpToken, surcharge)
  }

  async saveSituationsJeune(situations: JeuneMilo.Situations): Promise<void> {
    await SituationsMiloSqlModel.upsert(
      {
        idJeune: situations.idJeune,
        situationCourante: situations.situationCourante,
        situations: situations.situations
      },
      { conflictFields: ['id_jeune'] }
    )
  }

  async getJeunesMiloAvecIdDossier(
    offset: number,
    limit: number
  ): Promise<JeuneMilo[]> {
    const jeunesMiloSqlModel = await JeuneSqlModel.findAll({
      where: {
        structure: Core.Structure.MILO,
        idPartenaire: { [Op.ne]: null }
      },
      order: [['id', 'ASC']],
      offset,
      limit
    })

    return jeunesMiloSqlModel.map(jeuneSqlModel => {
      const jeuneMilo: JeuneMilo = {
        ...fromSqlToJeune(jeuneSqlModel),
        idStructureMilo: jeuneSqlModel.idStructureMilo ?? undefined
      }
      return jeuneMilo
    })
  }

  async save(
    jeune: JeuneMilo,
    codeStructureMilo?: string | null,
    dateFinCEJ?: DateTime | null
  ): Promise<void> {
    let nouveauCodeStructure = codeStructureMilo

    if (
      nouveauCodeStructure &&
      nouveauCodeStructure !== jeune.idStructureMilo
    ) {
      const structureSql =
        await StructureMiloSqlModel.findByPk(nouveauCodeStructure)
      if (!structureSql) {
        nouveauCodeStructure = null
      }
    }

    await JeuneSqlModel.update(
      {
        dateFinCEJ: dateFinCEJ && dateFinCEJ.toJSDate(),
        idStructureMilo: nouveauCodeStructure
      },
      { where: { id: jeune.id } }
    )
  }

  async getSituationsByJeune(
    idJeune: string
  ): Promise<JeuneMilo.Situations | undefined> {
    const situationsSql = await SituationsMiloSqlModel.findOne({
      where: { idJeune }
    })

    return situationsSql
      ? {
          idJeune: situationsSql.idJeune,
          situationCourante: situationsSql.situationCourante ?? undefined,
          situations: situationsSql.situations
        }
      : undefined
  }

  async marquerAARchiver(id: string, aArchiver: boolean): Promise<void> {
    if (aArchiver) await JeuneMiloAArchiverSqlModel.upsert({ idJeune: id })
    else await JeuneMiloAArchiverSqlModel.destroy({ where: { idJeune: id } })
  }
}

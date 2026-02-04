import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { ActualiteMilo } from '../../../domain/milo/actualite.milo'
import {
  ActualiteMiloDto,
  ActualiteMiloSqlModel
} from '../../sequelize/models/actualite-milo.sql-model'
import { AsSql } from '../../sequelize/types'

@Injectable()
export class ActualiteMiloSqlRepository implements ActualiteMilo.Repository {
  async save(actualite: ActualiteMilo): Promise<void> {
    const dto: AsSql<ActualiteMiloDto> = {
      id: actualite.id,
      nomPrenomConseiller: actualite.nomPrenomConseiller,
      idStructureMilo: actualite.idStructureMilo,
      idConseiller: actualite.idConseiller,
      titre: actualite.titre,
      contenu: actualite.contenu,
      titreLien: actualite.titreLien ?? null,
      lien: actualite.lien ?? null,
      dateCreation: actualite.dateCreation.toJSDate(),
      dateModification: actualite.dateModification!.toJSDate(),
      dateSuppression: actualite.dateSuppression?.toJSDate() ?? null
    }
    await ActualiteMiloSqlModel.upsert(dto)
  }

  async get(id: string): Promise<ActualiteMilo | undefined> {
    const sqlModel = await ActualiteMiloSqlModel.findByPk(id)
    if (!sqlModel) return undefined
    return toActualiteMilo(sqlModel)
  }

  async delete(id: string): Promise<void> {
    await ActualiteMiloSqlModel.destroy({ where: { id } })
  }

  async findAllByStructureMilo(
    idStructureMilo: string
  ): Promise<ActualiteMilo[]> {
    const sqlModels = await ActualiteMiloSqlModel.findAll({
      where: { idStructureMilo },
      order: [['date_creation', 'DESC']]
    })
    return sqlModels.map(toActualiteMilo)
  }
}

function toActualiteMilo(sqlModel: ActualiteMiloSqlModel): ActualiteMilo {
  return {
    id: sqlModel.id,
    idStructureMilo: sqlModel.idStructureMilo,
    idConseiller: sqlModel.idConseiller,
    nomPrenomConseiller: sqlModel.nomPrenomConseiller,
    titre: sqlModel.titre,
    contenu: sqlModel.contenu,
    titreLien: sqlModel.titreLien ?? undefined,
    lien: sqlModel.lien ?? undefined,
    dateCreation: DateTime.fromJSDate(sqlModel.dateCreation),
    dateModification: sqlModel.dateModification
      ? DateTime.fromJSDate(sqlModel.dateModification)
      : undefined,
    dateSuppression: sqlModel.dateSuppression
      ? DateTime.fromJSDate(sqlModel.dateSuppression)
      : undefined
  }
}

import { Injectable } from '@nestjs/common'
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
      prenomNomConseiller: actualite.prenomNomConseiller,
      idStructureMilo: actualite.idStructureMilo,
      idConseiller: actualite.idConseiller,
      titre: actualite.titre,
      contenu: actualite.contenu,
      titreLien: actualite.titreLien ?? null,
      lien: actualite.lien ?? null,
      dateCreation: actualite.dateCreation.toJSDate(),
      dateModification: actualite.dateModification!.toJSDate() ?? null,
      dateSuppression: actualite.dateSuppression?.toJSDate() ?? null
    }
    await ActualiteMiloSqlModel.upsert(dto)
  }
}

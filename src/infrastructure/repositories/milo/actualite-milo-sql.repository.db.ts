import { Injectable } from '@nestjs/common'
import { ActualiteMilo } from '../../../domain/milo/actualite.milo'
import {
  ActualiteMiloDto,
  ActualiteMiloSqlModel
} from '../../sequelize/models/actualite-milo.sql-model'
import { AsSql } from '../../sequelize/types'
import { DateService } from '../../../utils/date-service'

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
      dateModification: actualite.dateModification?.toJSDate() ?? null,
      dateSuppression: actualite.dateSuppression?.toJSDate() ?? null
    }
    await ActualiteMiloSqlModel.upsert(dto)
  }

  async getByStructureMilo(idStructureMilo: string): Promise<ActualiteMilo[]> {
    const actualites = await ActualiteMiloSqlModel.findAll({
      where: { idStructureMilo },
      order: [['dateCreation', 'ASC']]
    })

    return actualites.map(this.mapToDomain)
  }

  private mapToDomain(dto: ActualiteMiloSqlModel): ActualiteMilo {
    return {
      id: dto.id,
      idStructureMilo: dto.idStructureMilo,
      prenomNomConseiller: dto.prenomNomConseiller,
      idConseiller: dto.idConseiller,
      titre: dto.titre,
      contenu: dto.contenu,
      titreLien: dto.titreLien ?? undefined,
      lien: dto.lien ?? undefined,
      dateCreation: DateService.fromJSDateToDateTime(dto.dateCreation)!,
      dateModification: dto.dateModification
        ? DateService.fromJSDateToDateTime(dto.dateModification)!
        : undefined,
      dateSuppression: dto.dateSuppression
        ? DateService.fromJSDateToDateTime(dto.dateSuppression)!
        : undefined
    }
  }
}

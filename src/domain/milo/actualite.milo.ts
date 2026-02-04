import { DateTime } from 'luxon'
import { Injectable } from '@nestjs/common'
import { IdService } from '../../utils/id-service'
import { DateService } from '../../utils/date-service'

export const ActualiteMiloRepositoryToken = 'ActualiteMiloRepositoryToken'

export interface ActualiteMilo {
  id: string
  idStructureMilo: string
  idConseiller: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
  dateCreation: DateTime
  dateModification: DateTime
}

export namespace ActualiteMilo {
  export interface InfosCreation {
    idStructureMilo: string
    idConseiller: string
    titre: string
    contenu: string
    titreLien?: string
    lien?: string
  }

  export interface Repository {
    save(actualite: ActualiteMilo): Promise<void>

    get(id: string): Promise<ActualiteMilo | undefined>

    delete(id: string): Promise<void>

    findAllByStructureMilo(idStructureMilo: string): Promise<ActualiteMilo[]>
  }

  @Injectable()
  export class Factory {
    constructor(
      private idService: IdService,
      private dateService: DateService
    ) {}

    creer(infosCreation: InfosCreation): ActualiteMilo {
      const maintenant = this.dateService.now()
      return {
        id: this.idService.uuid(),
        idStructureMilo: infosCreation.idStructureMilo,
        idConseiller: infosCreation.idConseiller,
        titre: infosCreation.titre,
        contenu: infosCreation.contenu,
        titreLien: infosCreation.titreLien,
        lien: infosCreation.lien,
        dateCreation: maintenant,
        dateModification: maintenant
      }
    }
  }
}

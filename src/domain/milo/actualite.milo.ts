import { DateTime } from 'luxon'
import { Injectable } from '@nestjs/common'
import { IdService } from '../../utils/id-service'
import { DateService } from '../../utils/date-service'

export const ActualiteMiloRepositoryToken = 'ActualiteMiloRepositoryToken'

export interface ActualiteMilo {
  id: string
  idStructureMilo: string
  prenomNomConseiller: string
  idConseiller: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
  dateCreation: DateTime
  dateModification?: DateTime
  dateSuppression?: DateTime
}

export namespace ActualiteMilo {
  export interface InfosCreation {
    idStructureMilo: string
    idConseiller: string
    prenomNomConseiller: string
    titre: string
    contenu: string
    titreLien?: string
    lien?: string
  }

  export interface Repository {
    save(actualite: ActualiteMilo): Promise<void>
  }

  const TITRE_PAR_DEFAUT = 'En savoir plus'

  @Injectable()
  export class Factory {
    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    creer(infosCreation: InfosCreation): ActualiteMilo {
      const maintenant = this.dateService.now()
      const titreLien =
        infosCreation.lien && !infosCreation.titreLien
          ? TITRE_PAR_DEFAUT
          : infosCreation.titreLien
      return {
        id: this.idService.uuid(),
        idStructureMilo: infosCreation.idStructureMilo,
        prenomNomConseiller: infosCreation.prenomNomConseiller,
        idConseiller: infosCreation.idConseiller,
        titre: infosCreation.titre,
        contenu: infosCreation.contenu,
        titreLien,
        lien: infosCreation.lien,
        dateCreation: maintenant,
        dateModification: undefined,
        dateSuppression: undefined
      }
    }
  }
}

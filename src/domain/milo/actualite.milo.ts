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

  export interface InfosModification {
    titre: string
    contenu: string
    titreLien?: string
    lien?: string
  }

  export interface Repository {
    get(id: string): Promise<ActualiteMilo | undefined>
    save(actualite: ActualiteMilo): Promise<void>
    delete(id: string): Promise<void>
    getByStructureMilo(idStructureMilo: string): Promise<ActualiteMilo[]>
  }

  @Injectable()
  export class Factory {
    private static readonly TITRE_LIEN_PAR_DEFAUT = 'En savoir plus'

    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    private static titreLienEffectif(
      lien?: string,
      titreLien?: string
    ): string | undefined {
      if (lien && !titreLien) return Factory.TITRE_LIEN_PAR_DEFAUT
      return titreLien
    }

    creer(infosCreation: InfosCreation): ActualiteMilo {
      return {
        id: this.idService.uuid(),
        idStructureMilo: infosCreation.idStructureMilo,
        prenomNomConseiller: infosCreation.prenomNomConseiller,
        idConseiller: infosCreation.idConseiller,
        titre: infosCreation.titre,
        contenu: infosCreation.contenu,
        titreLien: Factory.titreLienEffectif(
          infosCreation.lien,
          infosCreation.titreLien
        ),
        lien: infosCreation.lien,
        dateCreation: this.dateService.now(),
        dateModification: undefined,
        dateSuppression: undefined
      }
    }

    modifier(
      actualite: ActualiteMilo,
      infosModification: InfosModification
    ): ActualiteMilo {
      return {
        ...actualite,
        titre: infosModification.titre,
        contenu: infosModification.contenu,
        titreLien: Factory.titreLienEffectif(
          infosModification.lien,
          infosModification.titreLien
        ),
        lien: infosModification.lien,
        dateModification: this.dateService.now()
      }
    }
  }
}

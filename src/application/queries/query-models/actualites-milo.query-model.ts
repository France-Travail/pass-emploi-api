export interface ActualiteMiloBaseQueryModel {
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
  prenomNomConseiller: string
  dateCreation: string
  dateSuppression?: string
}

export type ActualiteMiloJeuneQueryModel = ActualiteMiloBaseQueryModel

export interface ActualiteMiloConseillerQueryModel extends ActualiteMiloBaseQueryModel {
  id: string
  proprietaire: boolean
}

export interface ActualitesMiloJeuneQueryModel {
  actualites: ActualiteMiloJeuneQueryModel[]
}

export interface ActualitesMiloConseillerQueryModel {
  actualites: ActualiteMiloConseillerQueryModel[]
}

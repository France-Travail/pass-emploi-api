export interface ActualiteMiloJeuneQueryModel {
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
  nomPrenomConseiller: string
  dateCreation: string
  dateSuppression?: string
}

export interface ActualiteMiloConseillerQueryModel {
  id: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
  prenomNomConseiller: string
  dateCreation: string
  dateSuppression?: string
  proprietaire: boolean
}

export interface ActualitesMiloJeuneQueryModel {
  actualites: ActualiteMiloJeuneQueryModel[]
}

export interface ActualitesMiloConseillerQueryModel {
  actualites: ActualiteMiloConseillerQueryModel[]
}

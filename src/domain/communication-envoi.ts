export namespace CommunicationEnvoi {
  export enum Statut {
    A_ENVOYER = 'A_ENVOYER',
    EN_COURS = 'EN_COURS',
    ENVOYEE = 'ENVOYEE',
    ERREUR = 'ERREUR',
    TOKEN_INVALIDE = 'TOKEN_INVALIDE'
  }

  export interface Compteurs {
    aEnvoyer: number
    enCours: number
    envoyees: number
    erreurs: number
    tokensInvalides: number
  }
}

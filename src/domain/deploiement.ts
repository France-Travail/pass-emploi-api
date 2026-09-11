export namespace Deploiement {
  // Seule énumération du mécanisme : à J, FONCTIONNALITE fait apparaître le drapeau, MIGRATION refuse la connexion.
  export enum Nature {
    FONCTIONNALITE = 'FONCTIONNALITE',
    MIGRATION = 'MIGRATION'
  }
}

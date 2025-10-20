export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'

export namespace FeatureFlip {
  export enum Tag {
    DEMARCHES_IA = 'DEMARCHES_IA',
    MIGRATION = 'MIGRATION'
  }
  export interface Repository {
    featureActivePourBeneficiaire(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<boolean>
    featureActivePourConseiller(
      tag: Tag,
      idConseiller: string
    ): Promise<boolean>
  }
}

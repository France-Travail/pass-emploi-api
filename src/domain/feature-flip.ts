import { Inject, Injectable } from '@nestjs/common'
import { Authentification } from './authentification'

export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'

export namespace FeatureFlip {
  export enum Tag {
    DEMARCHES_IA = 'DEMARCHES_IA',
    MIGRATION_PHASE_A = 'MIGRATION_PHASE_A',
    MIGRATION_PHASE_B = 'MIGRATION_PHASE_B',
    MIGRATION_PHASE_TEST = 'MIGRATION_PHASE_TEST'
  }

  export interface UtilisateurFeature {
    id: string
    type: Authentification.Type.JEUNE | Authentification.Type.CONSEILLER
  }

  export interface Repository {
    getTagSiFeatureActivePourLeConseiller(
      tags: Tag[],
      idConseiller: string
    ): Promise<Tag | undefined>
    getTagSiFeatureActivePourLeConseillerDuJeune(
      tags: Tag[],
      idBeneficiaire: string
    ): Promise<Tag | undefined>
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: Repository
    ) {}

    async laFeatureEstActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      return !!(await this.getTagSiFeatureActive([tag], utilisateur))
    }

    private async getTagSiFeatureActive(
      tags: Tag[],
      utilisateur: UtilisateurFeature
    ): Promise<Tag | undefined> {
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          return this.featureFlipRepository.getTagSiFeatureActivePourLeConseiller(
            tags,
            utilisateur.id
          )
        case Authentification.Type.JEUNE:
          return this.featureFlipRepository.getTagSiFeatureActivePourLeConseillerDuJeune(
            tags,
            utilisateur.id
          )
      }
    }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Core } from './core'
import { IdEtStructure } from '../infrastructure/repositories/feature-flip.repository.db'
import { Authentification } from './authentification'
import Structure = Core.Structure

export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'

export namespace FeatureFlip {
  const STRUCTURE_QUI_MIGRE = Structure.POLE_EMPLOI

  export enum Tag {
    DEMARCHES_IA = 'DEMARCHES_IA',
    MIGRATION = 'MIGRATION'
  }

  export interface UtilisateurFeature {
    id: string
    type: Authentification.Type.JEUNE | Authentification.Type.CONSEILLER
  }

  export interface Repository {
    getBeneficiaireSiFeatureActive(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<IdEtStructure | undefined>
    getConseillerSiFeatureActive(
      tag: Tag,
      idConseiller: string
    ): Promise<IdEtStructure | undefined>
    getIdsBeneficiairesDeLaFeature(tag: Tag): Promise<IdEtStructure[]>
  }

  @Injectable()
  export class Service {
    private readonly dateDeMigration?: DateTime

    constructor(
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: Repository,
      private readonly configService: ConfigService
    ) {
      const dateDeMigrationFromConfig = this.configService.get(
        'features.dateDeMigration'
      )

      this.dateDeMigration = dateDeMigrationFromConfig
        ? DateTime.fromISO(dateDeMigrationFromConfig).startOf('day')
        : undefined
    }

    async laFeatureEstActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      return !!(await this.getIdEtStructureSiFeatureActive(tag, utilisateur))
    }

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: UtilisateurFeature
    ): Promise<DateTime | undefined> {
      return (await this.faitPartieDeLaMigration(utilisateur))
        ? this.dateDeMigration
        : undefined
    }

    async recupererIdsDesBeneficiaireAMigrer(): Promise<string[]> {
      const idsBeneficiairesFeatureMigration =
        await this.featureFlipRepository.getIdsBeneficiairesDeLaFeature(
          FeatureFlip.Tag.MIGRATION
        )
      return idsBeneficiairesFeatureMigration
        .filter(beneficiaire => beneficiaire.structure === STRUCTURE_QUI_MIGRE)
        .map(beneficiaire => beneficiaire.id)
    }

    private async faitPartieDeLaMigration(
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      const idEtStructure = await this.getIdEtStructureSiFeatureActive(
        Tag.MIGRATION,
        utilisateur
      )
      return idEtStructure?.structure === STRUCTURE_QUI_MIGRE
    }

    private async getIdEtStructureSiFeatureActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<IdEtStructure | undefined> {
      let idEtStructure: IdEtStructure | undefined
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          idEtStructure =
            await this.featureFlipRepository.getConseillerSiFeatureActive(
              tag,
              utilisateur.id
            )
          break
        case Authentification.Type.JEUNE:
          idEtStructure =
            await this.featureFlipRepository.getBeneficiaireSiFeatureActive(
              tag,
              utilisateur.id
            )
      }
      return idEtStructure
    }
  }
}

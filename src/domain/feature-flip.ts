import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Core } from './core'
import { BeneficiaireMigration } from '../infrastructure/repositories/feature-flip.repository.db'
import { Authentification } from './authentification'
import Structure = Core.Structure

export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'

export namespace FeatureFlip {
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
    ): Promise<BeneficiaireMigration | undefined>
    getConseillerSiFeatureActive(
      tag: Tag,
      idConseiller: string
    ): Promise<BeneficiaireMigration | undefined>
    getIdsBeneficiairesDeLaFeature(tag: Tag): Promise<BeneficiaireMigration[]>
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
      const beneficiairesMigration =
        await this.featureFlipRepository.getIdsBeneficiairesDeLaFeature(
          FeatureFlip.Tag.MIGRATION
        )
      return beneficiairesMigration
        .filter(beneficiaire =>
          this.structureEligibleMigration(
            beneficiaire.structureConseillerRattachement
          )
        )
        .filter(beneficiaire =>
          this.structureEligibleMigration(beneficiaire.structure)
        )
        .map(beneficiaire => beneficiaire.id)
    }

    private async faitPartieDeLaMigration(
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      const idEtStructure = await this.getIdEtStructureSiFeatureActive(
        Tag.MIGRATION,
        utilisateur
      )
      return (
        this.structureEligibleMigration(idEtStructure?.structure) &&
        (idEtStructure?.structureConseillerRattachement
          ? this.structureEligibleMigration(
              idEtStructure?.structureConseillerRattachement
            )
          : true)
      )
    }

    private async getIdEtStructureSiFeatureActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<BeneficiaireMigration | undefined> {
      let idEtStructure: BeneficiaireMigration | undefined
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

    private structureEligibleMigration(
      structure: Core.Structure | undefined
    ): boolean {
      return structure === Structure.POLE_EMPLOI
    }
  }
}

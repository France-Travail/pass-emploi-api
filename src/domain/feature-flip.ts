import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Authentification } from './authentification'

export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'

export class BeneficiaireMigration {
  constructor(id: string) {
    this.id = id
  }

  id: string
}

export class ConseillerMigration {
  constructor(id: string) {
    this.id = id
  }

  id: string
}

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
    getBeneficiaireSiFeatureActivePourLeConseillerInitial(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<BeneficiaireMigration | undefined>
    getConseillerSiFeatureActive(
      tag: Tag,
      idConseiller: string
    ): Promise<ConseillerMigration | undefined>
    getBeneficiairesDeLaFeatureDuConseillerInitial(
      tag: Tag
    ): Promise<BeneficiaireMigration[]>
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
      return !!(await this.getUtilisateurSiFeatureActive(tag, utilisateur))
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
        await this.featureFlipRepository.getBeneficiairesDeLaFeatureDuConseillerInitial(
          FeatureFlip.Tag.MIGRATION
        )
      return beneficiairesMigration.map(beneficiaire => beneficiaire.id)
    }

    private async faitPartieDeLaMigration(
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      return !!(await this.getUtilisateurSiFeatureActive(
        Tag.MIGRATION,
        utilisateur
      ))
    }

    private async getUtilisateurSiFeatureActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<BeneficiaireMigration | ConseillerMigration | undefined> {
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          return this.featureFlipRepository.getConseillerSiFeatureActive(
            tag,
            utilisateur.id
          )
        case Authentification.Type.JEUNE:
          return this.featureFlipRepository.getBeneficiaireSiFeatureActivePourLeConseillerInitial(
            tag,
            utilisateur.id
          )
      }
    }
  }
}

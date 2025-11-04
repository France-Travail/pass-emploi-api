import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'

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
    getListActiveJeunes(tag: Tag): Promise<string[]>
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

    async recupererDateDeMigrationBeneficiaire(
      idBeneficiaire: string
    ): Promise<DateTime | undefined> {
      const faitPartieDeLaMigration = await this.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        idBeneficiaire
      )
      return faitPartieDeLaMigration ? this.dateDeMigration : undefined
    }

    async recupererDateDeMigrationConseiller(
      idConseiller: string
    ): Promise<DateTime | undefined> {
      const faitPartieDeLaMigration = await this.featureActivePourConseiller(
        FeatureFlip.Tag.MIGRATION,
        idConseiller
      )
      return faitPartieDeLaMigration ? this.dateDeMigration : undefined
    }

    async featureActivePourBeneficiaire(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<boolean> {
      return this.featureFlipRepository.featureActivePourBeneficiaire(
        tag,
        idBeneficiaire
      )
    }

    async featureActivePourConseiller(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<boolean> {
      return this.featureFlipRepository.featureActivePourConseiller(
        tag,
        idBeneficiaire
      )
    }

    async recupererListeDesBeneficiaireAMigrer(tag: Tag): Promise<string[]> {
      return await this.featureFlipRepository.getListActiveJeunes(tag)
    }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { TIME_ZONE_EUROPE_PARIS } from '../config/configuration'

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

  @Injectable()
  export class Service {
    private readonly dateDeMigration?: string

    constructor(
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: Repository,
      private readonly configService: ConfigService
    ) {
      const dateDeMigrationFromConfig = this.configService.get(
        'features.dateDeMigration'
      )

      this.dateDeMigration = dateDeMigrationFromConfig
        ? DateTime.fromISO(dateDeMigrationFromConfig, {
            zone: TIME_ZONE_EUROPE_PARIS
          })
            .startOf('day')
            .toISO()
        : undefined
    }

    async recupererDateDeMigrationBeneficiaire(
      idBeneficiaire: string
    ): Promise<string | undefined> {
      const faitPartieDeLaMigration = await this.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        idBeneficiaire
      )
      return faitPartieDeLaMigration ? this.dateDeMigration : undefined
    }

    async recupererDateDeMigrationConseiller(
      idConseiller: string
    ): Promise<string | undefined> {
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
  }
}

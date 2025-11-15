import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Core } from './core'
import { Authentification } from './authentification'

export const FeatureFlipRepositoryToken = 'FeatureFlipRepositoryToken'
const STRUCTURE_ELIGIBLE = Core.Structure.POLE_EMPLOI

export abstract class UtilisateurMigration {
  constructor(id: string, structure: Core.Structure) {
    this.id = id
    this.structure = structure
  }

  id: string
  structure: Core.Structure
  abstract structureEligible(): boolean
}

export class BeneficiaireMigration extends UtilisateurMigration {
  constructor(
    id: string,
    structure: Core.Structure,
    structureConseillerRattachement: Core.Structure
  ) {
    super(id, structure)
    this.structureConseillerRattachement = structureConseillerRattachement
  }

  structureConseillerRattachement: Core.Structure
  structureEligible(): boolean {
    return (
      this.structure === STRUCTURE_ELIGIBLE &&
      this.structureConseillerRattachement === STRUCTURE_ELIGIBLE
    )
  }
}
export class ConseillerMigration extends UtilisateurMigration {
  structureEligible(): boolean {
    return this.structure === STRUCTURE_ELIGIBLE
  }
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
    getBeneficiaireSiFeatureActive(
      tag: Tag,
      idBeneficiaire: string
    ): Promise<BeneficiaireMigration | undefined>
    getConseillerSiFeatureActive(
      tag: Tag,
      idConseiller: string
    ): Promise<ConseillerMigration | undefined>
    getBeneficiairesDeLaFeature(tag: Tag): Promise<BeneficiaireMigration[]>
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
        await this.featureFlipRepository.getBeneficiairesDeLaFeature(
          FeatureFlip.Tag.MIGRATION
        )
      return beneficiairesMigration
        .filter(beneficiaire => beneficiaire.structureEligible())
        .map(beneficiaire => beneficiaire.id)
    }

    private async faitPartieDeLaMigration(
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      const utilisateurMigration = await this.getUtilisateurSiFeatureActive(
        Tag.MIGRATION,
        utilisateur
      )
      return utilisateurMigration
        ? utilisateurMigration.structureEligible()
        : false
    }

    private async getUtilisateurSiFeatureActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<UtilisateurMigration | undefined> {
      let utilisateurMigration: UtilisateurMigration | undefined
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          utilisateurMigration =
            await this.featureFlipRepository.getConseillerSiFeatureActive(
              tag,
              utilisateur.id
            )
          break
        case Authentification.Type.JEUNE:
          utilisateurMigration =
            await this.featureFlipRepository.getBeneficiaireSiFeatureActive(
              tag,
              utilisateur.id
            )
      }
      return utilisateurMigration
    }
  }
}

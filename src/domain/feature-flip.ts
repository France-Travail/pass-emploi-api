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

export enum PhaseDeMigration {
  PHASE_A = 'PHASE_A',
  PHASE_B = 'PHASE_B'
}

export namespace FeatureFlip {
  export enum Tag {
    DEMARCHES_IA = 'DEMARCHES_IA',
    MIGRATION_PHASE_A = 'MIGRATION_PHASE_A',
    MIGRATION_PHASE_B = 'MIGRATION_PHASE_B'
  }

  export function getTagPourPhase(phase: PhaseDeMigration): Tag {
    switch (phase) {
      case PhaseDeMigration.PHASE_A:
        return Tag.MIGRATION_PHASE_A
      case PhaseDeMigration.PHASE_B:
        return Tag.MIGRATION_PHASE_B
    }
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
    private readonly datesDeMigration: Map<PhaseDeMigration, DateTime>

    constructor(
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: Repository,
      private readonly configService: ConfigService
    ) {
      this.datesDeMigration = new Map()

      const datePhaseA = this.configService.get(
        'features.dateDeMigrationPhaseA'
      )
      if (datePhaseA) {
        this.datesDeMigration.set(
          PhaseDeMigration.PHASE_A,
          DateTime.fromISO(datePhaseA).startOf('day')
        )
      }

      const datePhaseB = this.configService.get(
        'features.dateDeMigrationPhaseB'
      )
      if (datePhaseB) {
        this.datesDeMigration.set(
          PhaseDeMigration.PHASE_B,
          DateTime.fromISO(datePhaseB).startOf('day')
        )
      }
    }

    async laFeatureEstActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      return !!(await this.getUtilisateurSiFeatureActive(tag, utilisateur))
    }

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: UtilisateurFeature,
      phase: PhaseDeMigration
    ): Promise<DateTime | undefined> {
      const tag = getTagPourPhase(phase)
      return (await this.faitPartieDeLaMigration(utilisateur, tag))
        ? this.datesDeMigration.get(phase)
        : undefined
    }

    async recupererIdsDesBeneficiaireAMigrer(
      phase: PhaseDeMigration
    ): Promise<string[]> {
      const tag = getTagPourPhase(phase)
      const beneficiairesMigration =
        await this.featureFlipRepository.getBeneficiairesDeLaFeatureDuConseillerInitial(
          tag
        )
      return beneficiairesMigration.map(beneficiaire => beneficiaire.id)
    }

    private async faitPartieDeLaMigration(
      utilisateur: UtilisateurFeature,
      tag: Tag
    ): Promise<boolean> {
      return !!(await this.getUtilisateurSiFeatureActive(tag, utilisateur))
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

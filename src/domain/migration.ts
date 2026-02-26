import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Authentification } from './authentification'
import { FeatureFlip, FeatureFlipRepositoryToken } from './feature-flip'
import { DateService } from '../utils/date-service'

export const MigrationRepositoryToken = 'MigrationRepositoryToken'

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

export interface RebasculementOrphelin {
  idJeune: string
  ancienIdConseiller: string
  nouveauIdConseiller: string
}

export namespace Migration {
  export enum PhaseDeMigration {
    PHASE_A = 'PHASE_A',
    PHASE_B = 'PHASE_B',
    PHASE_TEST = 'PHASE_TEST'
  }

  interface PhaseConfig {
    tag: FeatureFlip.Tag
    configKey: string
  }

  export const PHASES_CONFIG: Record<PhaseDeMigration, PhaseConfig> = {
    [PhaseDeMigration.PHASE_A]: {
      tag: FeatureFlip.Tag.MIGRATION_PHASE_A,
      configKey: 'features.dateDeMigrationPhaseA'
    },
    [PhaseDeMigration.PHASE_B]: {
      tag: FeatureFlip.Tag.MIGRATION_PHASE_B,
      configKey: 'features.dateDeMigrationPhaseB'
    },
    [PhaseDeMigration.PHASE_TEST]: {
      tag: FeatureFlip.Tag.MIGRATION_PHASE_TEST,
      configKey: 'features.dateDeMigrationPhaseTest'
    }
  }

  const TAG_TO_PHASE: Partial<Record<FeatureFlip.Tag, PhaseDeMigration>> =
    Object.fromEntries(
      Object.entries(PHASES_CONFIG).map(([phase, config]) => [
        config.tag,
        phase
      ])
    )

  export function getTagPourPhase(phase: PhaseDeMigration): FeatureFlip.Tag {
    return PHASES_CONFIG[phase].tag
  }

  export function getPhasePourTag(
    tag: FeatureFlip.Tag
  ): PhaseDeMigration | undefined {
    return TAG_TO_PHASE[tag]
  }

  export interface Repository {
    getBeneficiairesDeLaFeatureDuConseillerInitial(
      tag: FeatureFlip.Tag
    ): Promise<BeneficiaireMigration[]>
    rebasculerOrphelinsDePhase(
      tag: FeatureFlip.Tag
    ): Promise<RebasculementOrphelin[]>
  }

  @Injectable()
  export class Service {
    private readonly datesDeMigration: Map<PhaseDeMigration, DateTime>

    constructor(
      @Inject(MigrationRepositoryToken)
      private readonly migrationRepository: Repository,
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: FeatureFlip.Repository,
      private readonly configService: ConfigService,
      private readonly dateService: DateService
    ) {
      this.datesDeMigration = new Map()

      for (const [phase, config] of Object.entries(PHASES_CONFIG)) {
        const date = this.configService.get(config.configKey)
        if (date) {
          this.datesDeMigration.set(
            phase as PhaseDeMigration,
            DateTime.fromISO(date).startOf('day')
          )
        }
      }
    }

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: FeatureFlip.UtilisateurFeature
    ): Promise<DateTime | undefined> {
      const phase = await this.faitPartieDeLaMigration(utilisateur)
      return phase ? this.datesDeMigration.get(phase) : undefined
    }

    async recupererIdsDesBeneficiaireAMigrer(
      phase: PhaseDeMigration
    ): Promise<string[]> {
      const tag = getTagPourPhase(phase)
      const beneficiairesMigration =
        await this.migrationRepository.getBeneficiairesDeLaFeatureDuConseillerInitial(
          tag
        )
      return beneficiairesMigration.map(beneficiaire => beneficiaire.id)
    }

    async rebasculerOrphelinsDePhase(
      phase: PhaseDeMigration
    ): Promise<RebasculementOrphelin[]> {
      const tag = getTagPourPhase(phase)
      return this.migrationRepository.rebasculerOrphelinsDePhase(tag)
    }

    async faitPartieDeLaMigrationEtLaDateEstPassee(
      utilisateur: FeatureFlip.UtilisateurFeature
    ): Promise<boolean> {
      const dateDeMigration =
        await this.recupererDateDeMigrationSiLUtilisateurDoitMigrer(utilisateur)

      if (
        dateDeMigration &&
        DateService.isGreaterOrEqualAtTheStartOfDay(
          this.dateService.now(),
          dateDeMigration
        )
      ) {
        return true
      }

      return false
    }

    private async faitPartieDeLaMigration(
      utilisateur: FeatureFlip.UtilisateurFeature
    ): Promise<PhaseDeMigration | undefined> {
      const allPhaseTags = Object.values(PhaseDeMigration).map(getTagPourPhase)

      let tag: FeatureFlip.Tag | undefined
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          tag =
            await this.featureFlipRepository.getTagSiFeatureActivePourLeConseiller(
              allPhaseTags,
              utilisateur.id
            )
          break
        case Authentification.Type.JEUNE:
          tag =
            await this.featureFlipRepository.getTagSiFeatureActivePourLeConseillerDuJeune(
              allPhaseTags,
              utilisateur.id
            )
          break
      }

      return tag ? getPhasePourTag(tag) : undefined
    }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Authentification } from './authentification'
import { DateService } from '../utils/date-service'

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
  export enum PhaseDeMigration {
    PHASE_A = 'PHASE_A',
    PHASE_B = 'PHASE_B'
  }

  export enum Tag {
    DEMARCHES_IA = 'DEMARCHES_IA',
    MIGRATION_PHASE_A = 'MIGRATION_PHASE_A',
    MIGRATION_PHASE_B = 'MIGRATION_PHASE_B'
  }

  interface PhaseConfig {
    tag: Tag
    configKey: string
  }

  export const PHASES_CONFIG: Record<PhaseDeMigration, PhaseConfig> = {
    [PhaseDeMigration.PHASE_A]: {
      tag: Tag.MIGRATION_PHASE_A,
      configKey: 'features.dateDeMigrationPhaseA'
    },
    [PhaseDeMigration.PHASE_B]: {
      tag: Tag.MIGRATION_PHASE_B,
      configKey: 'features.dateDeMigrationPhaseB'
    }
  }

  const TAG_TO_PHASE: Partial<Record<Tag, PhaseDeMigration>> =
    Object.fromEntries(
      Object.entries(PHASES_CONFIG).map(([phase, config]) => [
        config.tag,
        phase
      ])
    )

  export function getTagPourPhase(phase: PhaseDeMigration): Tag {
    return PHASES_CONFIG[phase].tag
  }

  export function getPhasePourTag(tag: Tag): PhaseDeMigration | undefined {
    return TAG_TO_PHASE[tag]
  }

  export interface UtilisateurFeature {
    id: string
    type: Authentification.Type.JEUNE | Authentification.Type.CONSEILLER
  }

  export interface Repository {
    getBeneficiairesDeLaFeatureDuConseillerInitial(
      tag: Tag
    ): Promise<BeneficiaireMigration[]>
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
    private readonly datesDeMigration: Map<PhaseDeMigration, DateTime>

    constructor(
      @Inject(FeatureFlipRepositoryToken)
      private readonly featureFlipRepository: Repository,
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

    async laFeatureEstActive(
      tag: Tag,
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      return !!(await this.getTagSiFeatureActive([tag], utilisateur))
    }

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: UtilisateurFeature
    ): Promise<DateTime | undefined> {
      const phase = await this.faitPartieDeLaMigration(utilisateur)
      return phase ? this.datesDeMigration.get(phase) : undefined
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

    async faitPartieDeLaMigrationEtLaDateEstPassee(
      utilisateur: UtilisateurFeature
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
      utilisateurFeature: UtilisateurFeature
    ): Promise<PhaseDeMigration | undefined> {
      const allPhaseDeMigration: PhaseDeMigration[] =
        Object.values(PhaseDeMigration)
      const tag = await this.getTagSiFeatureActive(
        allPhaseDeMigration.map(phaseDeMigration =>
          getTagPourPhase(phaseDeMigration)
        ),
        utilisateurFeature
      )
      if (tag) {
        return getPhasePourTag(tag)
      }
      return undefined
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

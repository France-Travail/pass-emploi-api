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

export enum PhaseDeMigration {
  PHASE_A = 'PHASE_A',
  PHASE_B = 'PHASE_B'
}

export interface MigrationActive {
  phase: PhaseDeMigration
  dateDeMigration: DateTime
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
      private readonly configService: ConfigService,
      private readonly dateService: DateService
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

    async recupererMigrationActiveSiDateArrivee(
      utilisateur: UtilisateurFeature
    ): Promise<boolean> {
      //refléchir à optimiser la perf car ouvert à chaque accueil
      const dateDeMigration =
        await this.recupererDateDeMigrationSiLUtilisateurDoitMigrer(utilisateur)

      //doit on gerer si il est dans deux phase exemple phase a et b
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
      // update pour récupérer tout dans l'énum
      for (const phase of [
        PhaseDeMigration.PHASE_A,
        PhaseDeMigration.PHASE_B
      ]) {
        const tag = getTagPourPhase(phase)
        const utilisateur = await this.getUtilisateurSiFeatureActive(
          tag,
          utilisateurFeature
        )
        if (utilisateur) {
          return phase
        }
      }
      return undefined
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

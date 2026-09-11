import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../utils/date-service'
import { Authentification } from './authentification'

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
  // Les ids des vagues de migration vivent en base, aucun n'est figé ici.
  export interface Utilisateur {
    id: string
    type: Authentification.Type.JEUNE | Authentification.Type.CONSEILLER
  }

  export interface Repository {
    existe(idMigration: string): Promise<boolean>
    getBeneficiairesDeLaMigrationDuConseillerInitial(
      idMigration: string
    ): Promise<BeneficiaireMigration[]>
    rebasculerOrphelins(idMigration: string): Promise<RebasculementOrphelin[]>
    getDateDeMigrationDuConseiller(
      idConseiller: string
    ): Promise<DateTime | undefined>
    getDateDeMigrationDuConseillerDuBeneficiaire(
      idBeneficiaire: string
    ): Promise<DateTime | undefined>
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(MigrationRepositoryToken)
      private readonly migrationRepository: Repository,
      private readonly dateService: DateService
    ) {}

    async migrationExiste(idMigration: string): Promise<boolean> {
      return this.migrationRepository.existe(idMigration)
    }

    // Une vague sans date de migration ne fait basculer personne : c'est la
    // date qui déclenche, pas l'appartenance à la vague.
    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: Utilisateur
    ): Promise<DateTime | undefined> {
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          return this.migrationRepository.getDateDeMigrationDuConseiller(
            utilisateur.id
          )
        case Authentification.Type.JEUNE:
          return this.migrationRepository.getDateDeMigrationDuConseillerDuBeneficiaire(
            utilisateur.id
          )
      }
    }

    async recupererIdsDesBeneficiaireAMigrer(
      idMigration: string
    ): Promise<string[]> {
      const beneficiairesMigration =
        await this.migrationRepository.getBeneficiairesDeLaMigrationDuConseillerInitial(
          idMigration
        )
      return beneficiairesMigration.map(beneficiaire => beneficiaire.id)
    }

    async rebasculerOrphelins(
      idMigration: string
    ): Promise<RebasculementOrphelin[]> {
      return this.migrationRepository.rebasculerOrphelins(idMigration)
    }

    async faitPartieDeLaMigrationEtLaDateEstPassee(
      utilisateur: Utilisateur
    ): Promise<boolean> {
      const dateDeMigration =
        await this.recupererDateDeMigrationSiLUtilisateurDoitMigrer(utilisateur)

      if (!dateDeMigration) return false

      return DateService.isGreaterOrEqualAtTheStartOfDay(
        this.dateService.now(),
        dateDeMigration
      )
    }
  }
}

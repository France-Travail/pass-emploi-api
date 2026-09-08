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

export interface RebasculementOrphelin {
  idJeune: string
  ancienIdConseiller: string
  nouveauIdConseiller: string
}

export namespace Migration {
  // Une migration est un déploiement de nature MIGRATION, désigné par l'id de sa population.
  export interface Utilisateur {
    id: string
    type: Authentification.Type.JEUNE | Authentification.Type.CONSEILLER
  }

  export interface Repository {
    populationConcerneeParUneMigration(idPopulation: string): Promise<boolean>
    // Jeunes dont le profil correspond à la population qui migre, ou dont le conseiller de référence y est cité par email.
    getBeneficiairesAMigrerParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<BeneficiaireMigration[]>
    rebasculerOrphelins(idPopulation: string): Promise<RebasculementOrphelin[]>
    getDateDeMigrationDuConseiller(
      idConseiller: string
    ): Promise<DateTime | undefined>
    // Date de la migration qui vise le jeune, par son propre profil ou par son conseiller de référence cité par email.
    getDateDeMigrationDuBeneficiaire(
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

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: Utilisateur
    ): Promise<DateTime | undefined> {
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          return this.migrationRepository.getDateDeMigrationDuConseiller(
            utilisateur.id
          )
        case Authentification.Type.JEUNE:
          return this.migrationRepository.getDateDeMigrationDuBeneficiaire(
            utilisateur.id
          )
      }
    }

    async recupererIdsDesBeneficiaireAMigrer(
      idPopulation: string
    ): Promise<string[]> {
      const beneficiairesMigration =
        await this.migrationRepository.getBeneficiairesAMigrerParProfilOuConseillerCite(
          idPopulation
        )
      return beneficiairesMigration.map(beneficiaire => beneficiaire.id)
    }

    async rebasculerOrphelins(
      idPopulation: string
    ): Promise<RebasculementOrphelin[]> {
      return this.migrationRepository.rebasculerOrphelins(idPopulation)
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

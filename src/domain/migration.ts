import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../utils/date-service'
import { Authentification } from './authentification'
import { Population, PopulationRepositoryToken } from './population'

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
    getBeneficiairesAMigrerParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<BeneficiaireMigration[]>
    rebasculerOrphelins(idPopulation: string): Promise<RebasculementOrphelin[]>
    getDateDeMigration(idsPopulations: string[]): Promise<DateTime | undefined>
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(PopulationRepositoryToken)
      private readonly populationRepository: Population.Repository,
      @Inject(MigrationRepositoryToken)
      private readonly migrationRepository: Repository,
      private readonly dateService: DateService
    ) {}

    async recupererDateDeMigrationSiLUtilisateurDoitMigrer(
      utilisateur: Utilisateur
    ): Promise<DateTime | undefined> {
      let idsPopulations: string[]
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          idsPopulations =
            await this.populationRepository.getIdsPopulationsDuConseiller(
              utilisateur.id
            )
          break
        case Authentification.Type.JEUNE:
          idsPopulations =
            await this.populationRepository.getIdsPopulationsDuJeune(
              utilisateur.id
            )
          break
      }
      return this.migrationRepository.getDateDeMigration(idsPopulations)
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

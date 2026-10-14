import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { NonTraitableReason } from '../building-blocks/types/domain-error'
import { DateService } from '../utils/date-service'
import { Authentification } from './authentification'
import { Profil } from './profil'

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

  export interface MigrationActive {
    dateActivation: DateTime
    idPopulation: string
  }

  const DISPOSITIFS_PASS_EMPLOI: Array<Profil.Dispositif | null> = [
    Profil.Dispositif.BRSA,
    Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
    Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
    Profil.Dispositif.EQUIP_EMPLOI_RECRUT,
    null
  ]

  export function reasonDeMigration(profil: {
    structure: Profil.Structure | null
    dispositif: Profil.Dispositif | null
  }): NonTraitableReason {
    const estPassEmploi =
      profil.structure === Profil.Structure.FRANCE_TRAVAIL &&
      DISPOSITIFS_PASS_EMPLOI.includes(profil.dispositif)
    return estPassEmploi
      ? NonTraitableReason.MIGRATION_PASS_EMPLOI_PARCOURS_EMPLOI
      : NonTraitableReason.MIGRATION_PARCOURS_EMPLOI
  }

  export interface Repository {
    populationConcerneeParUneMigration(idPopulation: string): Promise<boolean>
    getBeneficiairesAMigrerParProfilOuConseillerCite(
      idPopulation: string
    ): Promise<BeneficiaireMigration[]>
    rebasculerOrphelins(idPopulation: string): Promise<RebasculementOrphelin[]>
    getMigrationDuConseiller(
      idConseiller: string
    ): Promise<MigrationActive | undefined>
    getMigrationDuBeneficiaire(
      idBeneficiaire: string
    ): Promise<MigrationActive | undefined>
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(MigrationRepositoryToken)
      private readonly migrationRepository: Repository,
      private readonly dateService: DateService
    ) {}

    async recupererMigrationDeLUtilisateur(
      utilisateur: Utilisateur
    ): Promise<MigrationActive | undefined> {
      switch (utilisateur.type) {
        case Authentification.Type.CONSEILLER:
          return this.migrationRepository.getMigrationDuConseiller(
            utilisateur.id
          )
        case Authentification.Type.JEUNE:
          return this.migrationRepository.getMigrationDuBeneficiaire(
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

    async populationDeMigrationActive(
      utilisateur: Utilisateur
    ): Promise<string | undefined> {
      const migration = await this.recupererMigrationDeLUtilisateur(utilisateur)
      if (!migration) return undefined

      const dateAtteinte = DateService.isGreaterOrEqualAtTheStartOfDay(
        this.dateService.now(),
        migration.dateActivation
      )
      return dateAtteinte ? migration.idPopulation : undefined
    }
  }
}

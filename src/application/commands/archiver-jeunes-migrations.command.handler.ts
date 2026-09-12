import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../building-blocks/types/result'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Migration } from '../../domain/migration'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport

const COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT =
  "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."

export interface ArchiverJeuneCommand {
  idJeune: string
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement?: DateTime
  commentaire?: string
}

export interface ArchiverJeunesMigrationCommand {
  phaseDeMigration: string
}

@Injectable()
export class ArchiverJeunesMigrationCommandHandler extends CommandHandler<
  ArchiverJeunesMigrationCommand,
  void
> {
  constructor(
    private readonly evenementService: EvenementService,
    private readonly migrationService: Migration.Service,
    private readonly archiverJeuneService: ArchiveJeune.Service
  ) {
    super('ArchiverJeuneCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async handle(command: ArchiverJeunesMigrationCommand): Promise<Result> {
    // La route archive des comptes : mieux vaut refuser un id inconnu que
    // rapporter un archivage de zéro bénéficiaire.
    const migrationExiste = await this.migrationService.migrationExiste(
      command.phaseDeMigration
    )
    if (!migrationExiste) {
      return failure(new NonTrouveError('Migration', command.phaseDeMigration))
    }

    const idJeunes =
      await this.migrationService.recupererIdsDesBeneficiaireAMigrer(
        command.phaseDeMigration
      )

    ;(async (): Promise<void> => {
      const echecs: string[] = []

      for (const idJeune of idJeunes) {
        const result = await this.archiverJeuneService.archiver(
          idJeune,
          COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT,
          MotifSuppressionSupport.MIGRATION
        )
        if (isFailure(result)) {
          echecs.push(idJeune)
        }
      }

      this.logger.log(
        {
          phaseDeMigration: command.phaseDeMigration,
          total: idJeunes.length,
          succes: idJeunes.length - echecs.length,
          echecs: echecs.length,
          idsEnEchec: echecs
        },
        'Archivage terminé'
      )
    })()

    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.COMPTE_ARCHIVE,
      utilisateur
    )
  }
}

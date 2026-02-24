import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  emptySuccess,
  isFailure,
  Result
} from '../../building-blocks/types/result'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune } from '../../domain/jeune/jeune'
import { FeatureFlip } from '../../domain/feature-flip'
import { SupportAuthorizer } from '../authorizers/support-authorizer'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport
import PhaseDeMigration = FeatureFlip.PhaseDeMigration

const COMMENTAIRE_SUPPRESSION_MIGRATION_SUPPORT =
  "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."

export interface ArchiverJeuneCommand {
  idJeune: Jeune.Id
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement?: DateTime
  commentaire?: string
}

export interface ArchiverJeunesMigrationCommand {
  phaseDeMigration: PhaseDeMigration
}

@Injectable()
export class ArchiverJeunesMigrationCommandHandler extends CommandHandler<
  ArchiverJeunesMigrationCommand,
  void
> {
  constructor(
    private readonly evenementService: EvenementService,
    private readonly authorizeSupport: SupportAuthorizer,
    private readonly featureFlipService: FeatureFlip.Service,
    private readonly archiverJeuneService: ArchiveJeune.Service
  ) {
    super('ArchiverJeuneCommandHandler')
  }

  async authorize(
    _command: ArchiverJeunesMigrationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.authorizeSupport.autoriserSupport(utilisateur)
  }

  async handle(command: ArchiverJeunesMigrationCommand): Promise<Result> {
    const idJeunes =
      await this.featureFlipService.recupererIdsDesBeneficiaireAMigrer(
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

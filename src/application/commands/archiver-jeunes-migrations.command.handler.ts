import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune } from '../../domain/jeune/jeune'
import { FeatureFlip } from '../../domain/feature-flip'
import { SupportAuthorizer } from '../authorizers/support-authorizer'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport
import { ArchiverJeuneSupportCommand } from './support/archiver-jeune-support.command.handler'

export interface ArchiverJeuneCommand {
  idJeune: Jeune.Id
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement?: DateTime
  commentaire?: string
}

@Injectable()
export class ArchiverJeunesMigrationCommandHandler extends CommandHandler<
  ArchiverJeuneSupportCommand,
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
    _command: ArchiverJeuneSupportCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.authorizeSupport.autoriserSupport(utilisateur)
  }

  async handle(): Promise<Result> {
    const idJeunes =
      await this.featureFlipService.recupererListeDesBeneficiaireAMigrer(
        FeatureFlip.Tag.MIGRATION
      )

    for (const idJeune of idJeunes) {
      this.archiverJeuneService.archiver(
        idJeune,
        "Pour des raisons de migration nous avons procédé à l'archivage de votre compte.",
        MotifSuppressionSupport.MIGRATION
      )
    }

    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.COMPTE_ARCHIVE,
      utilisateur
    )
  }
}

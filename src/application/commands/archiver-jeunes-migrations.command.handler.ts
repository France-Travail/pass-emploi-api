import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Result, emptySuccess } from '../../building-blocks/types/result'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune } from '../../domain/jeune/jeune'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { FeatureFlip } from '../../domain/feature-flip'

export interface ArchiverJeuneCommand {
  idJeune: Jeune.Id
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement?: DateTime
  commentaire?: string
}

@Injectable()
export class ArchiverJeunesMigrationCommandHandler extends CommandHandler<
  ArchiverJeuneCommand,
  void
> {
  constructor(
    private evenementService: EvenementService,
    private conseillerAuthorizer: ConseillerAuthorizer,
    private readonly featureFlipService: FeatureFlip.Service,
    private readonly archiverJeuneService: ArchiveJeune.Service
  ) {
    super('ArchiverJeuneCommandHandler')
  }

  async authorize(
    command: ArchiverJeuneCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserConseillerPourSonJeune(
      command.idJeune,
      utilisateur
    )
  }

  async handle(): Promise<Result> {
    const idJeunes =
      await this.featureFlipService.recupererListDesBeneficiaireAMigrer(
        FeatureFlip.Tag.MIGRATION
      )

    for (const idJeune of idJeunes) {
      this.archiverJeuneService.archiver(
        idJeune,
        "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."
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

import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { FeatureFlip } from '../../domain/feature-flip'
import { SupportAuthorizer } from '../authorizers/support-authorizer'
import PhaseDeMigration = FeatureFlip.PhaseDeMigration

export interface RebasculerJeunesOrphelinsMigrationCommand {
  phaseDeMigration: PhaseDeMigration
}

@Injectable()
export class RebasculerJeunesOrphelinsMigrationCommandHandler extends CommandHandler<
  RebasculerJeunesOrphelinsMigrationCommand,
  void
> {
  constructor(
    private readonly featureFlipService: FeatureFlip.Service,
    private readonly authorizeSupport: SupportAuthorizer
  ) {
    super('RebasculerJeunesOrphelinsMigrationCommandHandler')
  }

  async authorize(
    _command: RebasculerJeunesOrphelinsMigrationCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.authorizeSupport.autoriserSupport(utilisateur)
  }

  async handle(
    command: RebasculerJeunesOrphelinsMigrationCommand
  ): Promise<Result> {
    const rebasculements =
      await this.featureFlipService.rebasculerOrphelinsDePhase(
        command.phaseDeMigration
      )
    rebasculements.forEach(
      ({ idJeune, ancienIdConseiller, nouveauIdConseiller }) =>
        this.logger.log(
          { idJeune, ancienIdConseiller, nouveauIdConseiller },
          'Jeune rebasculé'
        )
    )
    this.logger.log(
      {
        phaseDeMigration: command.phaseDeMigration,
        count: rebasculements.length
      },
      'Rebasculement orphelins terminé'
    )
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

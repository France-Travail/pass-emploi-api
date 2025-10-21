import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'

import { Sequelize } from 'sequelize'
import { FeatureFlipSqlModel } from '../../../infrastructure/sequelize/models/feature-flip.sql-model'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'
import { SupportAuthorizer } from '../../authorizers/support-authorizer'
import { AsSql } from '../../../infrastructure/sequelize/types'
import { FeatureFlip } from '../../../domain/feature-flip'

export interface UpdateFeatureFlipCommand extends Command {
  emailsConseillersAjout?: string[]
  emailsConseillersSuppression?: string[]
  supprimerExistants?: boolean
  tagFeature: FeatureFlip.Tag
}

@Injectable()
export class UpdateFeatureFlipCommandHandler extends CommandHandler<
  UpdateFeatureFlipCommand,
  void
> {
  constructor(
    private supportAuthorizer: SupportAuthorizer,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {
    super('UpdateFeatureFlipCommandHandler')
  }

  async authorize(
    _command: UpdateFeatureFlipCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.supportAuthorizer.autoriserSupport(utilisateur)
  }
  async monitor(): Promise<void> {
    return
  }

  async handle(command: UpdateFeatureFlipCommand): Promise<Result> {
    if (command.supprimerExistants) {
      await FeatureFlipSqlModel.destroy({
        where: { featureTag: command.tagFeature }
      })
    }

    if (command.emailsConseillersAjout?.length) {
      const uniqueEmails: string[] = Array.from(
        new Set(command.emailsConseillersAjout)
      )
      const featureFlipsToCreate: Array<
        Omit<AsSql<FeatureFlipSqlModel>, 'id'>
      > = uniqueEmails.map(email => ({
        emailConseiller: email,
        featureTag: command.tagFeature
      }))
      await FeatureFlipSqlModel.bulkCreate(featureFlipsToCreate, {
        ignoreDuplicates: true
      })
    }

    if (command.emailsConseillersSuppression?.length) {
      await FeatureFlipSqlModel.destroy({
        where: {
          emailConseiller: command.emailsConseillersSuppression,
          featureTag: command.tagFeature
        }
      })
    }

    return emptySuccess()
  }
}

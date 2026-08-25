import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { emptySuccess, Result } from '../../../building-blocks/types/result'

import { FeatureFlip } from '../../../domain/feature-flip'
import { FeatureFlipSqlModel } from '../../../infrastructure/sequelize/models/feature-flip.sql-model'
import { AsSql } from '../../../infrastructure/sequelize/types'

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
  constructor() {
    super('UpdateFeatureFlipCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
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

import { Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../building-blocks/types/result'
import { estFranceTravail, Profil } from '../../../domain/profil'
import { AgenceSqlModel } from '../../../infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../infrastructure/sequelize/models/conseiller.sql-model'

export interface ModifierAgenceFTConseillerCommand extends Command {
  idConseiller: string
  idAgence: string
}

@Injectable()
export class ModifierAgenceFTConseillerCommandHandler extends CommandHandler<
  ModifierAgenceFTConseillerCommand,
  void
> {
  constructor() {
    super('ModifierAgenceFTConseillerCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(command: ModifierAgenceFTConseillerCommand): Promise<Result> {
    const conseillerSql = await ConseillerSqlModel.findByPk(
      command.idConseiller
    )
    if (!conseillerSql) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    if (!estFranceTravail(conseillerSql.structure)) {
      return failure(
        new MauvaiseCommandeError(
          `Le conseiller n'est pas France Travail (structure ${conseillerSql.structure})`
        )
      )
    }

    const agenceSql = await AgenceSqlModel.findOne({
      where: {
        id: command.idAgence,
        structure: Profil.Structure.FRANCE_TRAVAIL
      }
    })
    if (!agenceSql) {
      return failure(
        new NonTrouveError('Agence France Travail', command.idAgence)
      )
    }

    await ConseillerSqlModel.update(
      { idAgence: agenceSql.id, nomManuelAgence: null },
      { where: { id: conseillerSql.id } }
    )

    return emptySuccess()
  }
}

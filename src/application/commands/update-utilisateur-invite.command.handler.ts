import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import { Core } from '../../domain/core'
import { DateService } from '../../utils/date-service'
import { IdService } from '../../utils/id-service'
import { rootLogger } from '../../utils/logger.module'
import {
  queryModelFromUtilisateur,
  UtilisateurQueryModel
} from '../queries/query-models/authentification.query-model'

export interface UpdateUtilisateurInviteCommand extends Command {
  idUtilisateurAuth: string
}

export const PRENOM_INVITE_PAR_DEFAUT = 'Invité'

const CONTEXT_LOG = 'UpdateUtilisateurInviteCommandHandler'

@Injectable()
export class UpdateUtilisateurInviteCommandHandler extends CommandHandler<
  UpdateUtilisateurInviteCommand,
  UtilisateurQueryModel
> {
  constructor(
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly idService: IdService,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super('UpdateUtilisateurInviteCommandHandler')
  }

  async handle(
    command: UpdateUtilisateurInviteCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    const utilisateurExistant =
      await this.authentificationRepository.getJeuneInvite(
        command.idUtilisateurAuth
      )

    if (utilisateurExistant) {
      // Distinguer créé / retrouvé est le seul moyen de suivre le volume réel
      // de nouveaux invités : un ratio anormal signale des ré-enregistrements
      // (bug), un pic de créations signale un abus.
      rootLogger.info(
        {
          context: CONTEXT_LOG,
          event: { action: 'invite_account_retrieved', outcome: 'success' }
        },
        'invite_account_retrieved'
      )
      return success(queryModelFromUtilisateur(utilisateurExistant))
    }

    const id = this.idService.uuid()
    const dateCreation = this.dateService.nowJs()

    await this.authentificationRepository.creerJeuneInvite({
      id,
      idAuthentification: command.idUtilisateurAuth,
      prenom: PRENOM_INVITE_PAR_DEFAUT,
      dateCreation
    })

    rootLogger.info(
      {
        context: CONTEXT_LOG,
        event: { action: 'invite_account_created', outcome: 'success' }
      },
      'invite_account_created'
    )

    return success(
      queryModelFromUtilisateur({
        id,
        idAuthentification: command.idUtilisateurAuth,
        prenom: PRENOM_INVITE_PAR_DEFAUT,
        nom: '',
        structure: Core.Structure.INVITE,
        type: Authentification.Type.JEUNE,
        roles: []
      })
    )
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

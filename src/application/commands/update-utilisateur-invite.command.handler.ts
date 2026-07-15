import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  emptySuccess,
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
import {
  queryModelFromUtilisateur,
  UtilisateurQueryModel
} from '../queries/query-models/authentification.query-model'

export interface UpdateUtilisateurInviteCommand extends Command {
  idUtilisateurAuth: string
}

// L'invité est anonyme à la création : il pourra choisir son nom d'affichage
// depuis l'app ensuite (le JWT le reprendra au refresh suivant).
export const PRENOM_INVITE_PAR_DEFAUT = 'Invité'

/**
 * Mode invité : appelé par Connect au premier lancement de l'app.
 *
 * Contrairement à UpdateUtilisateurCommandHandler, il n'y a aucune donnée
 * d'IDP à rapprocher ni d'éligibilité à vérifier : l'invité est anonyme. On
 * crée le jeune invité s'il n'existe pas, sinon on renvoie l'existant.
 * Idempotent : rejouer le même sub ne crée pas de doublon.
 */
@Injectable()
export class UpdateUtilisateurInviteCommandHandler extends CommandHandler<
  UpdateUtilisateurInviteCommand,
  UtilisateurQueryModel
> {
  constructor(
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly idService: IdService,
    private readonly dateService: DateService
  ) {
    super('UpdateUtilisateurInviteCommandHandler')
  }

  async handle(
    command: UpdateUtilisateurInviteCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurExistant =
      await this.authentificationRepository.getJeuneInvite(
        command.idUtilisateurAuth
      )

    if (utilisateurExistant) {
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

    return success(
      queryModelFromUtilisateur({
        id,
        idAuthentification: command.idUtilisateurAuth,
        prenom: PRENOM_INVITE_PAR_DEFAUT,
        nom: '',
        structure: Core.Structure.INVITE,
        type: Authentification.Type.JEUNE,
        datePremiereConnexion: dateCreation,
        dateDerniereConnexion: dateCreation,
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

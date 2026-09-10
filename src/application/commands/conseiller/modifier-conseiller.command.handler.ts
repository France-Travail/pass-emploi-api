import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure
} from '../../../building-blocks/types/result'
import { Agence, AgenceRepositoryToken } from '../../../domain/agence'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { DISPOSITIFS_ACCOMPAGNES, Profil } from '../../../domain/profil'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'

export interface ModifierConseillerCommand extends Command {
  idConseiller: string
  agence?: Agence
  dispositif?: Profil.Dispositif
  dateSignatureCGU?: string
  dateVisionnageActus?: string
  notificationsSonores?: boolean
}

@Injectable()
export class ModifierConseillerCommandHandler extends CommandHandler<
  ModifierConseillerCommand,
  void
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(
    @Inject(ConseillerRepositoryToken)
    private conseillerRepository: Conseiller.Repository,
    @Inject(AgenceRepositoryToken)
    private agencesRepository: Agence.Repository,
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    @Inject(AuthentificationRepositoryToken)
    private authentificationRepository: Authentification.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('ModifierConseillerCommandHandler')
  }

  async handle(command: ModifierConseillerCommand): Promise<Result> {
    const conseillerActuel = await this.conseillerRepository.get(
      command.idConseiller
    )
    if (!conseillerActuel) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    if (command.agence?.id) {
      const agence = await this.agencesRepository.get(
        command.agence.id,
        conseillerActuel.structure
      )
      if (!agence) {
        return failure(new NonTrouveError('Agence', command.agence.id))
      }
    }

    const infosDeMiseAJour: Conseiller.InfosDeMiseAJour = {
      notificationsSonores:
        command.notificationsSonores ?? conseillerActuel.notificationsSonores,
      agence: command.agence ?? conseillerActuel.agence,
      dispositif: command.dispositif,
      dateSignatureCGU: command.dateSignatureCGU
        ? DateTime.fromISO(command.dateSignatureCGU)
        : conseillerActuel.dateSignatureCGU,
      dateVisionnageActus: command.dateVisionnageActus
        ? DateTime.fromISO(command.dateVisionnageActus)
        : conseillerActuel.dateVisionnageActus
    }

    const conseillerResult = Conseiller.mettreAJour(
      conseillerActuel,
      infosDeMiseAJour
    )

    if (isFailure(conseillerResult)) {
      return conseillerResult
    }
    await this.conseillerRepository.save(conseillerResult.data)

    if (
      command.dispositif &&
      command.dispositif !== conseillerActuel.dispositif
    ) {
      const idsJeunes =
        await this.jeuneRepository.changerDispositifDesJeunesDuConseiller(
          command.idConseiller,
          command.dispositif
        )
      await this.deconnecter(idsJeunes)
    }
    return emptySuccess()
  }

  // Le dispositif voyage dans le token : les jeunes se reconnectent, le conseiller l'est par le web.
  private async deconnecter(idsUtilisateurs: string[]): Promise<void> {
    for (const idUtilisateur of idsUtilisateurs) {
      await this.authentificationRepository.deleteUtilisateurIdp(idUtilisateur)
    }
  }

  async authorize(
    query: ModifierConseillerCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      query.idConseiller,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

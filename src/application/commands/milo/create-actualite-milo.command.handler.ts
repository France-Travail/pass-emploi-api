import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { estMilo } from '../../../domain/core'
import { Evenement, EvenementService } from '../../../domain/evenement'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { ConseillerInterStructureMiloAuthorizer } from '../../authorizers/conseiller-inter-structure-milo-authorizer'

export interface CreateActualiteMiloCommand extends Command {
  idStructureMilo: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
}

@Injectable()
export class CreateActualiteMiloCommandHandler extends CommandHandler<
  CreateActualiteMiloCommand,
  ActualiteMilo
> {
  constructor(
    private conseillerInterStructureMiloAuthorizer: ConseillerInterStructureMiloAuthorizer,
    @Inject(ActualiteMiloRepositoryToken)
    private actualiteMiloRepository: ActualiteMilo.Repository,
    private actualiteMiloFactory: ActualiteMilo.Factory,
    private readonly evenementService: EvenementService
  ) {
    super('CreateActualiteMiloCommandHandler')
  }

  async authorize(
    command: CreateActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!estMilo(utilisateur.structure)) {
      return this.conseillerInterStructureMiloAuthorizer.autoriserConseillerPourUneStructureMilo(
        command.idStructureMilo,
        utilisateur
      )
    }
    return this.conseillerInterStructureMiloAuthorizer.autoriserConseillerPourUneStructureMilo(
      command.idStructureMilo,
      utilisateur
    )
  }

  async handle(
    command: CreateActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result<ActualiteMilo>> {
    const actualite = this.actualiteMiloFactory.creer({
      idStructureMilo: command.idStructureMilo,
      idConseiller: utilisateur.id,
      titre: command.titre,
      contenu: command.contenu,
      titreLien: command.titreLien,
      lien: command.lien
    })

    await this.actualiteMiloRepository.save(actualite)

    return success(actualite)
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_CREEE,
      utilisateur
    )
  }
}

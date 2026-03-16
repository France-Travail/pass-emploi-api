import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { estMilo } from '../../../domain/core'
import { Evenement, EvenementService } from '../../../domain/evenement'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { Conseiller } from '../../../domain/milo/conseiller'
import { ConseillerMiloRepositoryToken } from '../../../domain/milo/conseiller.milo.db'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { Notification } from '../../../domain/notification/notification'

export interface CreateActualiteMiloCommand extends Command {
  idConseiller: string
  prenomNomConseiller: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
}

@Injectable()
export class CreateActualiteMiloCommandHandler extends CommandHandler<
  CreateActualiteMiloCommand,
  void
> {
  constructor(
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    private readonly actualiteMiloFactory: ActualiteMilo.Factory,
    private readonly evenementService: EvenementService,
    @Inject(ConseillerMiloRepositoryToken)
    private readonly conseillerMiloRepository: Conseiller.Milo.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    private readonly notificationService: Notification.Service
  ) {
    super('CreateActualiteMiloCommandHandler')
  }

  async authorize(
    command: CreateActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async handle(command: CreateActualiteMiloCommand): Promise<Result> {
    const resultConseiller = await this.conseillerMiloRepository.get(
      command.idConseiller
    )
    if (isFailure(resultConseiller)) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    const conseiller = resultConseiller.data

    const actualite = this.actualiteMiloFactory.creer({
      idStructureMilo: conseiller.structure.id,
      idConseiller: command.idConseiller,
      prenomNomConseiller: command.prenomNomConseiller,
      titre: command.titre,
      contenu: command.contenu,
      titreLien: command.titreLien,
      lien: command.lien
    })

    await this.actualiteMiloRepository.save(actualite)

    const jeunes = await this.jeuneRepository.findAllByIdStructureMilo(
      conseiller.structure.id
    )
    this.notificationService.notifierNouvelleActualite(jeunes, actualite.id)

    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_CREEE,
      utilisateur
    )
  }
}

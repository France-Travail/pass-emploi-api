import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  emptySuccess,
  failure,
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
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'

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
    @Inject(ConseillerRepositoryToken)
    private readonly conseillerRepository: Conseiller.Repository
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
    const conseiller = await this.conseillerRepository.get(command.idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    if (conseiller.agence?.id === undefined) {
      return failure(new NonTrouveError('Agence', conseiller.id))
    }

    const actualite = this.actualiteMiloFactory.creer({
      idStructureMilo: conseiller.agence.id,
      idConseiller: command.idConseiller,
      prenomNomConseiller: command.prenomNomConseiller,
      titre: command.titre,
      contenu: command.contenu,
      titreLien: command.titreLien,
      lien: command.lien
    })

    await this.actualiteMiloRepository.save(actualite)

    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_CREEE,
      utilisateur
    )
  }
}

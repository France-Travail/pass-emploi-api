import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { Profil } from '../../../domain/profil'
import { DateService } from '../../../utils/date-service'

export interface ModifierDispositifFTConseillerCommand extends Command {
  idConseiller: string
  dispositif: Profil.Dispositif
}

@Injectable()
export class ModifierDispositifFTConseillerCommandHandler extends CommandHandler<
  ModifierDispositifFTConseillerCommand,
  void
> {
  constructor(
    @Inject(ConseillerRepositoryToken)
    private conseillerRepository: Conseiller.Repository,
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    @Inject(AuthentificationRepositoryToken)
    private authentificationRepository: Authentification.Repository,
    private readonly dateService: DateService
  ) {
    super('ModifierDispositifFTConseillerCommandHandler')
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  async handle(
    command: ModifierDispositifFTConseillerCommand
  ): Promise<Result> {
    const conseiller = await this.conseillerRepository.get(command.idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    const conseillerResult = Conseiller.modifierDispositif(
      conseiller,
      command.dispositif,
      this.dateService.now()
    )
    if (isFailure(conseillerResult)) {
      return conseillerResult
    }
    await this.conseillerRepository.save(conseillerResult.data)

    // Même dispositif : seule la date bouge, la modale ne reviendra pas avant un an.
    if (command.dispositif === conseiller.dispositif) {
      return emptySuccess()
    }

    const idsJeunes =
      await this.jeuneRepository.changerDispositifDesJeunesDuConseiller(
        command.idConseiller,
        command.dispositif
      )
    // Le dispositif voyage dans le token : les jeunes et le conseiller se reconnectent.
    for (const idUtilisateur of [...idsJeunes, command.idConseiller]) {
      await this.authentificationRepository.deleteUtilisateurIdp(idUtilisateur)
    }
    return emptySuccess()
  }
}

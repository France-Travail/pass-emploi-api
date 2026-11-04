import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  EmailExisteDejaError,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Chat, ChatRepositoryToken } from '../../../domain/chat'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { PROFILS_FT_CONNECT } from '../../../domain/profil'

export interface CreateJeuneCommand extends Command {
  idConseiller: string
  firstName: string
  lastName: string
  email: string
}

@Injectable()
export class CreerJeunePoleEmploiCommandHandler extends CommandHandler<
  CreateJeuneCommand,
  Jeune
> {
  readonly profilsAutorises = PROFILS_FT_CONNECT

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(ConseillerRepositoryToken)
    private readonly conseillerRepository: Conseiller.Repository,
    @Inject(ChatRepositoryToken)
    private readonly chatRepository: Chat.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    private readonly jeuneFactory: Jeune.Factory
  ) {
    super('CreerJeunePoleEmploiCommandHandler')
  }

  async handle(command: CreateJeuneCommand): Promise<Result<Jeune>> {
    const conseiller = await this.conseillerRepository.get(command.idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }
    if (Conseiller.doitChoisirSonDispositif(conseiller)) {
      return failure(
        new MauvaiseCommandeError(
          'Le conseiller doit choisir son dispositif avant de créer un bénéficiaire'
        )
      )
    }

    const existant = await this.jeuneRepository.getByEmail(command.email, {
      includeConseiller: true
    })
    if (existant && Jeune.estAccompagne(existant)) {
      return failure(new EmailExisteDejaError(command.email))
    }

    const jeune = existant
      ? Jeune.reprendreEnAccompagnement(existant, conseiller)
      : this.jeuneFactory.creer({
          prenom: command.firstName,
          nom: command.lastName,
          email: command.email.toLocaleLowerCase(),
          conseiller: {
            id: conseiller.id,
            lastName: conseiller.lastName,
            firstName: conseiller.firstName,
            email: conseiller.email
          },
          structure: conseiller.structure,
          dispositif: Jeune.dispositifDuJeuneAccompagnePar(conseiller)
        })
    await this.jeuneRepository.save(jeune)
    await this.chatRepository.initializeChatIfNotExists(jeune.id, conseiller.id)
    return success(jeune)
  }

  async authorize(
    command: CreateJeuneCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

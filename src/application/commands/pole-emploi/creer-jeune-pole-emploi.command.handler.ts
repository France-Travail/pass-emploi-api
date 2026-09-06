import { Inject, Injectable } from '@nestjs/common'
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  EmailExisteDejaError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Chat, ChatRepositoryToken } from '../../../domain/chat'
import {
  Jeune,
  JeuneNonAccompagne,
  JeuneRepositoryToken
} from '../../../domain/jeune/jeune'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import {
  estConseilDepartemental,
  estDispositifNonAccompagne,
  estFranceTravail,
  Profil,
  TOUT_FRANCE_TRAVAIL
} from '../../../domain/profil'

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
  readonly profilsAutorises = TOUT_FRANCE_TRAVAIL

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

    const jeune = await this.jeuneRepository.getByEmail(command.email)
    if (jeune) {
      if (jeune.conseiller || !estDispositifNonAccompagne(jeune.dispositif)) {
        return failure(new EmailExisteDejaError(command.email))
      }
      return this.reprendreEnAccompagnement(
        jeune as JeuneNonAccompagne,
        conseiller
      )
    }

    const jeuneACreer: Jeune.Factory.ACreer = {
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
      dispositif: dispositifDuJeuneAccompagnePar(conseiller)
    }
    const nouveauJeune = this.jeuneFactory.creer(jeuneACreer)
    await this.jeuneRepository.save(nouveauJeune)
    await this.chatRepository.initializeChatIfNotExists(
      nouveauJeune.id,
      nouveauJeune.conseiller!.id
    )
    return success(nouveauJeune)
  }

  private async reprendreEnAccompagnement(
    jeune: JeuneNonAccompagne,
    conseiller: Conseiller
  ): Promise<Result<Jeune>> {
    const jeuneAccompagne: Jeune = {
      ...jeune,
      conseiller: {
        id: conseiller.id,
        lastName: conseiller.lastName,
        firstName: conseiller.firstName,
        email: conseiller.email
      },
      structure: conseiller.structure,
      dispositif: dispositifDuJeuneAccompagnePar(conseiller),
      preferences: {
        ...jeune.preferences,
        messages: true,
        creationActionConseiller: true
      }
    }

    await this.jeuneRepository.save(jeuneAccompagne)
    await this.chatRepository.initializeChatIfNotExists(
      jeuneAccompagne.id,
      conseiller.id
    )

    return success(jeuneAccompagne)
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

// Le jeune hérite du dispositif de son conseiller FT (null pour le Conseil départemental).
function dispositifDuJeuneAccompagnePar(
  conseiller: Conseiller
): Profil.Dispositif | null {
  const conseillerFTConnectAccompagnant =
    (estFranceTravail(conseiller.structure) ||
      estConseilDepartemental(conseiller.structure)) &&
    !estDispositifNonAccompagne(conseiller.dispositif)
  if (!conseillerFTConnectAccompagnant) {
    throw new RuntimeException()
  }
  return conseiller.dispositif
}

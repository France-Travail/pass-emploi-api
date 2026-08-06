import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { TOUS_LES_CONSEILLERS } from '../../domain/profil'
import { beneficiaireEstFTConnect } from '../../domain/core'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'

export interface ModifierJeuneDuConseillerCommand extends Command {
  idPartenaire?: string
  dispositif?: Jeune.Dispositif
  peutVoirLeComptageDesHeures?: boolean
  idJeune: string
}

@Injectable()
export class ModifierJeuneDuConseillerCommandHandler extends CommandHandler<
  ModifierJeuneDuConseillerCommand,
  void
> {
  readonly profilsAutorises = TOUS_LES_CONSEILLERS

  constructor(
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    private conseillerAuthorizer: ConseillerAuthorizer
  ) {
    super('ModifierJeuneDuConseillerCommandHandler')
  }

  async handle(command: ModifierJeuneDuConseillerCommand): Promise<Result> {
    const jeune = await this.jeuneRepository.get(command.idJeune)

    if (!jeune) {
      return failure(new NonTrouveError('Jeune', command.idJeune))
    }

    let jeuneMisAJour = jeune
    if (command.idPartenaire && beneficiaireEstFTConnect(jeune.structure)) {
      jeuneMisAJour = Jeune.mettreAJourIdPartenaire(jeune, command.idPartenaire)
    }
    if (command.dispositif) {
      jeuneMisAJour = Jeune.mettreAJourDispositif(jeune, command.dispositif)
    }

    if (command.peutVoirLeComptageDesHeures !== undefined) {
      jeuneMisAJour = Jeune.mettreAJourPeutVoirComptageDesHeures(
        jeune,
        command.peutVoirLeComptageDesHeures
      )
    }
    await this.jeuneRepository.save(jeuneMisAJour)

    return emptySuccess()
  }

  async authorize(
    command: ModifierJeuneDuConseillerCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserConseillerPourSonJeune(
      command.idJeune,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure
} from '../../building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import {
  DISPOSITIFS_ACCOMPAGNES,
  DISPOSITIFS_ATTRIBUABLES,
  imposeUneReconnexion,
  Profil,
  profilEstAutorise
} from '../../domain/profil'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { FonctionnaliteAuthorizer } from '../authorizers/fonctionnalite-authorizer'

export interface ModifierJeuneDuConseillerCommand extends Command {
  idPartenaire?: string
  dispositif?: Profil.Dispositif
  peutVoirLeComptageDesHeures?: boolean
  idJeune: string
}

@Injectable()
export class ModifierJeuneDuConseillerCommandHandler extends CommandHandler<
  ModifierJeuneDuConseillerCommand,
  void,
  Jeune
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    @Inject(AuthentificationRepositoryToken)
    private authentificationRepository: Authentification.Repository,
    private conseillerAuthorizer: ConseillerAuthorizer,
    private fonctionnaliteAuthorizer: FonctionnaliteAuthorizer
  ) {
    super('ModifierJeuneDuConseillerCommandHandler')
  }

  async getAggregate(
    command: ModifierJeuneDuConseillerCommand
  ): Promise<Jeune | undefined> {
    return this.jeuneRepository.get(command.idJeune)
  }

  async authorize(
    command: ModifierJeuneDuConseillerCommand,
    utilisateur: Authentification.Utilisateur,
    jeune: Jeune | undefined
  ): Promise<Result> {
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', command.idJeune))
    }
    const resultConseiller =
      await this.conseillerAuthorizer.autoriserConseillerPourSonJeune(
        command.idJeune,
        utilisateur
      )
    if (isFailure(resultConseiller)) return resultConseiller

    return this.fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller(
      utilisateur.id,
      command.dispositif
    )
  }

  async handle(
    command: ModifierJeuneDuConseillerCommand,
    _utilisateur: Authentification.Utilisateur,
    jeune: Jeune
  ): Promise<Result> {
    let jeuneMisAJour = jeune
    const estBeneficiaireFTConnect = [
      Profil.Structure.FRANCE_TRAVAIL,
      Profil.Structure.CONSEIL_DEPARTEMENTAL
    ].includes(jeune.structure)
    if (command.idPartenaire && estBeneficiaireFTConnect) {
      jeuneMisAJour = Jeune.mettreAJourIdPartenaire(jeune, command.idPartenaire)
    }
    if (command.dispositif) {
      const dispositifAttribuable = profilEstAutorise(
        { structure: jeune.structure, dispositif: command.dispositif },
        DISPOSITIFS_ATTRIBUABLES
      )
      if (!dispositifAttribuable) {
        return failure(
          new MauvaiseCommandeError(
            'Ce dispositif n’est pas proposé pour ce bénéficiaire'
          )
        )
      }
      jeuneMisAJour = Jeune.mettreAJourDispositif(jeune, command.dispositif)
    }

    if (command.peutVoirLeComptageDesHeures !== undefined) {
      jeuneMisAJour = Jeune.mettreAJourPeutVoirComptageDesHeures(
        jeune,
        command.peutVoirLeComptageDesHeures
      )
    }
    await this.jeuneRepository.save(jeuneMisAJour)

    if (
      command.dispositif &&
      imposeUneReconnexion(jeune, {
        structure: jeune.structure,
        dispositif: command.dispositif
      })
    ) {
      await this.authentificationRepository.deleteUtilisateurIdp(jeune.id)
    }

    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  protected labelsDuLog(
    _result: Result,
    command?: ModifierJeuneDuConseillerCommand,
    jeune?: Jeune
  ): Record<string, string> | undefined {
    if (!command?.dispositif) return undefined

    return {
      ...(jeune?.dispositif ? { dispositif_depart: jeune.dispositif } : {}),
      dispositif_arrivee: command.dispositif
    }
  }
}

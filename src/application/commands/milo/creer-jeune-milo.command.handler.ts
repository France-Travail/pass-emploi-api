import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  DossierExisteDejaError,
  EmailExisteDejaMiloError,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  failure,
  isFailure,
  isSuccess,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Profil } from '../../../domain/profil'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../../domain/authentification'
import { Chat, ChatRepositoryToken } from '../../../domain/chat'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { Core, estMilo } from '../../../domain/core'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import {
  JeuneMilo,
  JeuneMiloRepositoryToken
} from '../../../domain/milo/jeune.milo'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { IdentiteJeuneQueryModel } from '../../queries/query-models/jeunes.query-model'
import { OidcClient } from '../../../infrastructure/clients/oidc-client.db'

export interface CreerJeuneMiloCommand extends Command {
  idPartenaire: string
  nom: string
  prenom: string
  email: string
  idConseiller: string
  dispositif: Jeune.Dispositif.CEJ | Jeune.Dispositif.PACEA
  surcharge?: boolean
  peutVoirLeCompteurDesHeures: boolean
  accessToken: string
}

@Injectable()
export class CreerJeuneMiloCommandHandler extends CommandHandler<
  CreerJeuneMiloCommand,
  IdentiteJeuneQueryModel
> {
  readonly profilsAutorises = [Profil.CONSEILLER]

  constructor(
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(JeuneMiloRepositoryToken)
    private readonly miloJeuneRepository: JeuneMilo.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    @Inject(ConseillerRepositoryToken)
    private readonly conseillerRepository: Conseiller.Repository,
    @Inject(ChatRepositoryToken)
    private readonly chatRepository: Chat.Repository,
    private readonly jeuneFactory: Jeune.Factory,
    private readonly oidcClient: OidcClient
  ) {
    super('CreerJeuneMiloCommandHandler')
  }

  async handle(
    command: CreerJeuneMiloCommand
  ): Promise<Result<IdentiteJeuneQueryModel>> {
    const conseiller = await this.conseillerRepository.get(command.idConseiller)
    if (!conseiller) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    const [jeuneByEmail, jeuneByIdDossier] = await Promise.all([
      this.jeuneRepository.getByEmail(command.email, {
        includeConseiller: true
      }),
      this.miloJeuneRepository.getByIdDossier(command.idPartenaire, {
        includeConseiller: true
      })
    ])
    if (jeuneByEmail) {
      if (estMilo(jeuneByEmail.structure)) {
        return failure(
          new EmailExisteDejaMiloError(
            command.email,
            jeuneByEmail.conseiller?.email
          )
        )
      } else {
        return failure(new EmailExisteDejaMiloError(command.email))
      }
    }
    if (isSuccess(jeuneByIdDossier)) {
      return failure(
        new DossierExisteDejaError(
          command.idPartenaire,
          command.email,
          jeuneByIdDossier.data.conseiller?.email
        )
      )
    }

    const idpToken = await this.oidcClient.exchangeTokenConseillerMilo(
      command.accessToken
    )
    const result = await this.miloJeuneRepository.creerJeune(
      command.idPartenaire,
      idpToken,
      command.surcharge
    )

    if (isFailure(result)) {
      return result
    }

    if (result.data.existeDejaChezMilo && result.data.idAuthentification) {
      const utilisateurMilo =
        await this.authentificationRepository.getJeuneByStructure(
          result.data.idAuthentification,
          Core.Structure.MILO
        )
      if (utilisateurMilo) {
        return failure(
          new MauvaiseCommandeError(
            'Utilisateur déjà créé, veuillez contacter le support.'
          )
        )
      }
    }
    const nouveauJeune = await this.creerLeJeune(
      command,
      command.email,
      conseiller
    )

    const utilisateur: Partial<Authentification.Utilisateur> = {
      id: nouveauJeune.id,
      idAuthentification: result.data.idAuthentification
    }
    this.recupererStructure(nouveauJeune)
    await this.authentificationRepository.updateJeune(utilisateur)
    await this.chatRepository.initializeChatIfNotExists(
      nouveauJeune.id,
      conseiller.id
    )

    return success({
      id: nouveauJeune.id,
      prenom: nouveauJeune.firstName,
      nom: nouveauJeune.lastName
    })
  }

  async authorize(
    command: CreerJeuneMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async monitor(): Promise<void> {
    return
  }

  private async creerLeJeune(
    command: CreerJeuneMiloCommand,
    lowerCaseEmail: string,
    conseiller: Conseiller
  ): Promise<Jeune> {
    const jeuneACreer: Jeune.Factory.ACreer = {
      nom: command.nom,
      prenom: command.prenom,
      email: lowerCaseEmail,
      structure: Core.Structure.MILO,
      conseiller,
      idPartenaire: command.idPartenaire,
      dispositif: command.dispositif,
      peutVoirLeCompteurDesHeures: command.peutVoirLeCompteurDesHeures
    }

    const nouveauJeune = this.jeuneFactory.creer(jeuneACreer)
    await this.jeuneRepository.save(nouveauJeune)
    return nouveauJeune
  }

  private async recupererStructure(jeune: Jeune): Promise<void> {
    try {
      const resultDossier = await this.miloJeuneRepository.getDossier(
        jeune.idPartenaire!
      )
      if (isSuccess(resultDossier)) {
        const codeStructure = resultDossier.data.codeStructure
        await this.miloJeuneRepository.save(jeune, codeStructure)
      }
    } catch (e) {
      this.logger.warn(e)
    }
  }
}

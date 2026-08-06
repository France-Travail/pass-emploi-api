import { Inject, Injectable } from '@nestjs/common'
import { Command } from 'src/building-blocks/types/command'
import { CommandHandler } from 'src/building-blocks/types/command-handler'
import {
  emptySuccess,
  isFailure,
  Result
} from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { Profil } from 'src/domain/profil'
import { Conseiller } from 'src/domain/milo/conseiller'
import { estMilo } from 'src/domain/core'
import { ConseillerMiloRepositoryToken } from 'src/domain/milo/conseiller.milo.db'
import {
  SessionMilo,
  SessionMiloRepositoryToken
} from 'src/domain/milo/session.milo'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { Notification } from '../../../domain/notification/notification'
import { DateService, MILO_DATE_FORMAT } from '../../../utils/date-service'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { Evenement, EvenementService } from '../../../domain/evenement'
import Inscription = SessionMilo.Inscription

export interface UpdateSessionMiloCommand extends Command {
  idSession: string
  idConseiller: string
  accessToken: string
  estVisible?: boolean
  autoinscription?: boolean
  autodesinscription?: boolean
  inscriptions?: SessionMilo.Modification.Inscription[]
}

@Injectable()
export class UpdateSessionMiloCommandHandler extends CommandHandler<
  UpdateSessionMiloCommand,
  void
> {
  readonly profilsAutorises = [Profil.CONSEILLER]

  constructor(
    @Inject(ConseillerMiloRepositoryToken)
    private conseillerMiloRepository: Conseiller.Milo.Repository,
    @Inject(SessionMiloRepositoryToken)
    private sessionMiloRepository: SessionMilo.Repository,
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    private oidcClient: OidcClient,
    private dateService: DateService,
    private conseillerAuthorizer: ConseillerAuthorizer,
    private notificationService: Notification.Service,
    private evenementService: EvenementService
  ) {
    super('UpdateSessionMiloCommandHandler')
  }

  async handle(
    command: UpdateSessionMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    const conseillerMiloResult = await this.conseillerMiloRepository.get(
      command.idConseiller
    )
    if (isFailure(conseillerMiloResult)) {
      return conseillerMiloResult
    }
    const { structure: structureConseiller } = conseillerMiloResult.data

    const idpToken = await this.oidcClient.exchangeTokenConseillerMilo(
      command.accessToken
    )

    const resultSession = await this.sessionMiloRepository.getForConseiller(
      command.idSession,
      structureConseiller,
      idpToken
    )
    if (isFailure(resultSession)) return resultSession
    const session = resultSession.data

    const sessionModifiee = SessionMilo.modifier(
      session,
      this.dateService.now(),
      {
        nouvelleVisibilite: command.estVisible,
        nouvelleAutoinscription: command.autoinscription,
        nouvelleAutodesinscription: command.autodesinscription
      }
    )

    const resultInscriptions = SessionMilo.extraireInscriptionsATraiter(
      session,
      command.inscriptions ?? []
    )
    if (isFailure(resultInscriptions)) {
      return resultInscriptions
    }
    const inscriptionsATraiter = resultInscriptions.data

    const resultSave = await this.sessionMiloRepository.save(
      sessionModifiee,
      inscriptionsATraiter,
      idpToken
    )
    if (isFailure(resultSave)) return resultSave

    const [
      jeunesANotifierInscription = [],
      jeunesModifiesANotifierDesinscription = [],
      jeunesSupprimesANotifierDesinscription = []
    ] = await Promise.all([
      this.jeuneRepository.findAll(inscriptionsATraiter.idsJeunesAInscrire),
      this.jeuneRepository.findAll(
        trouverListesJeunesModifiesPourDesinscription(
          inscriptionsATraiter.inscriptionsAModifier
        )
      ),
      this.jeuneRepository.findAll(
        inscriptionsATraiter.inscriptionsASupprimer.map(
          inscription => inscription.idJeune
        )
      )
    ])

    if (jeunesANotifierInscription.length) {
      this.notificationService.notifierInscriptionSession(
        session.id,
        session.nom,
        session.debut.toFormat(MILO_DATE_FORMAT),
        jeunesANotifierInscription
      )
      this.evenementService.creer(
        Evenement.Code.SESSION_INSCRIPTION,
        utilisateur
      )
    }

    const jeunesANotifierDesinscription =
      jeunesModifiesANotifierDesinscription.concat(
        jeunesSupprimesANotifierDesinscription
      )
    if (jeunesANotifierDesinscription.length) {
      this.notificationService.notifierDesinscriptionSession(
        session.id,
        session.nom,
        session.debut.toFormat(MILO_DATE_FORMAT),
        jeunesANotifierDesinscription
      )
    }

    return emptySuccess()
  }

  async authorize(
    command: UpdateSessionMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: UpdateSessionMiloCommand
  ): Promise<void> {
    if (Authentification.estConseiller(utilisateur.type)) {
      if (command.estVisible !== undefined) {
        this.evenementService.creer(
          Evenement.Code.SESSION_MODIFICATION,
          utilisateur
        )
      }
    }
  }
}

function trouverListesJeunesModifiesPourDesinscription(
  inscriptionsModifiees: Array<Omit<Inscription, 'nom' | 'prenom'>>
): string[] {
  return inscriptionsModifiees
    .filter(inscription => inscription.statut !== Inscription.Statut.INSCRIT)
    .map(inscription => inscription.idJeune)
}

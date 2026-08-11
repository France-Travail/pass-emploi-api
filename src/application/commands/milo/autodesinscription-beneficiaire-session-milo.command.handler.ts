import { Inject } from '@nestjs/common'
import { CommandHandler } from 'src/building-blocks/types/command-handler'
import {
  DroitsInsuffisants,
  JeuneMiloSansIdDossier,
  JeuneMiloSansStructure,
  NonTraitableError,
  NonTraitableReason,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result,
  success
} from 'src/building-blocks/types/result'
import {
  Authentification,
  AuthentificationRepositoryToken
} from 'src/domain/authentification'
import { Chat, ChatRepositoryToken } from 'src/domain/chat'
import { Core } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { JeuneMilo, JeuneMiloRepositoryToken } from 'src/domain/milo/jeune.milo'
import {
  SessionMilo,
  SessionMiloBeneficiaire,
  SessionMiloRepositoryToken
} from 'src/domain/milo/session.milo'
import { Profil } from 'src/domain/profil'
import { ChatCryptoService } from 'src/utils/chat-crypto-service'
import { DateService } from 'src/utils/date-service'

export type AutodesinscrireBeneficiaireSessionMiloCommand = {
  idSession: string
  idBeneficiaire: string
  accessToken: string
  motif: string
}

type ChampsObligatoire = 'conseiller' | 'idPartenaire' | 'structureMilo'
type BeneficiaireMilo = Omit<JeuneMilo, ChampsObligatoire> &
  Required<Pick<JeuneMilo, ChampsObligatoire>>

export default class AutodesinscrireBeneficiaireSessionMiloCommandHandler extends CommandHandler<
  AutodesinscrireBeneficiaireSessionMiloCommand,
  void,
  JeuneMilo
> {
  readonly profilsAutorises = [Profil.Jeune.MILO]

  constructor(
    @Inject(JeuneMiloRepositoryToken)
    private readonly beneficiaireMiloRepository: JeuneMilo.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    @Inject(SessionMiloRepositoryToken)
    private readonly sessionMiloRepository: SessionMilo.Repository,
    @Inject(ChatRepositoryToken)
    private readonly chatRepository: Chat.Repository,
    private readonly chatCryptoService: ChatCryptoService,
    private readonly dateService: DateService,
    private readonly evenementService: EvenementService
  ) {
    super('AutodesinscrireBeneficiaireSessionMiloCommandHandler')
  }

  async getAggregate(
    command: AutodesinscrireBeneficiaireSessionMiloCommand
  ): Promise<JeuneMilo | undefined> {
    const result = await this.beneficiaireMiloRepository.get(
      command.idBeneficiaire
    )
    if (isFailure(result)) return undefined
    return result.data
  }

  async handle(
    command: AutodesinscrireBeneficiaireSessionMiloCommand,
    _utilisateur: Authentification.Utilisateur,
    aggregate?: JeuneMilo
  ): Promise<Result> {
    const resultBeneficiaire = this.recupererBeneficiaire(
      command.idBeneficiaire,
      aggregate
    )
    if (isFailure(resultBeneficiaire)) return resultBeneficiaire
    const beneficiaire = resultBeneficiaire.data

    const resultAccesMilo = await this.recupererAccesMilo(
      command.accessToken,
      beneficiaire.conseiller.id
    )
    if (isFailure(resultAccesMilo)) return resultAccesMilo
    const { accesMiloBeneficiaire, accesMiloConseiller } = resultAccesMilo.data

    const resultSession = await this.sessionMiloRepository.getForBeneficiaire(
      command.idSession,
      beneficiaire.idPartenaire,
      accesMiloBeneficiaire,
      beneficiaire.structureMilo.timezone
    )
    if (isFailure(resultSession)) return resultSession
    const session = resultSession.data

    const verificationDesinscription = SessionMilo.peutDesinscrireBeneficiaire(
      session,
      this.dateService.now()
    )
    if (isFailure(verificationDesinscription)) return verificationDesinscription

    const resultDesinscription =
      await this.sessionMiloRepository.desinscrireBeneficiaire(
        command.idSession,
        beneficiaire.idPartenaire,
        accesMiloConseiller
      )
    if (isFailure(resultDesinscription)) return resultDesinscription

    this.envoyerMessageConseiller(
      beneficiaire.id,
      beneficiaire.conseiller.id,
      session,
      command.motif
    )

    return emptySuccess()
  }

  async authorize(
    command: AutodesinscrireBeneficiaireSessionMiloCommand,
    utilisateur: Authentification.Utilisateur,
    aggregate?: JeuneMilo
  ): Promise<Result> {
    if (!aggregate)
      return failure(new NonTrouveError('Bénéficiaire', command.idBeneficiaire))

    if (
      !Authentification.estJeune(utilisateur.type) ||
      aggregate.id !== utilisateur.id
    )
      return failure(new DroitsInsuffisants())

    return emptySuccess()
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.SESSION_AUTODESINSCRIPTION,
      utilisateur
    )
  }

  private recupererBeneficiaire(
    idBeneficiaire: string,
    aggregate?: JeuneMilo
  ): Result<BeneficiaireMilo> {
    if (!aggregate)
      return failure(new NonTrouveError('Bénéficiaire', idBeneficiaire))

    if (!aggregate.conseiller) {
      return failure(
        new NonTraitableError(
          'Beneficiaire',
          aggregate.id,
          NonTraitableReason.BENEFICIAIRE_SANS_CONSEILLER
        )
      )
    }
    if (!aggregate.idPartenaire) {
      return failure(new JeuneMiloSansIdDossier(aggregate.id))
    }
    if (!aggregate.structureMilo) {
      return failure(new JeuneMiloSansStructure(aggregate.id))
    }

    return success({
      ...aggregate,
      conseiller: aggregate.conseiller,
      idPartenaire: aggregate.idPartenaire,
      structureMilo: aggregate.structureMilo
    })
  }

  private async recupererAccesMilo(
    accessToken: string,
    idConseiller: string
  ): Promise<
    Result<{ accesMiloBeneficiaire: string; accesMiloConseiller: string }>
  > {
    const [accesMiloBeneficiaire, resultAccesMiloConseiller] =
      await Promise.all([
        this.authentificationRepository.recupererAccesPartenaire(
          accessToken,
          Core.Structure.MILO
        ),
        this.authentificationRepository.seFairePasserPourUnConseiller(
          idConseiller,
          accessToken,
          Core.Structure.MILO
        )
      ])
    if (isFailure(resultAccesMiloConseiller)) return resultAccesMiloConseiller

    return success({
      accesMiloBeneficiaire,
      accesMiloConseiller: resultAccesMiloConseiller.data
    })
  }

  private async envoyerMessageConseiller(
    idBeneficiaire: string,
    idConseiller: string,
    session: SessionMiloBeneficiaire,
    motif: string
  ): Promise<void> {
    const conversation =
      await this.chatRepository.recupererConversationIndividuelle(
        idBeneficiaire
      )
    if (!conversation) {
      this.logger.error({ message: 'Aucune conversation trouvée' })
      return
    }

    const { encryptedText, iv } = this.chatCryptoService.encrypt(
      "Votre bénéficiaire a annulé sa participation à l'événement suivant"
    )
    await this.chatRepository.envoyerMessageIndividuel(
      conversation.id,
      {
        message: encryptedText,
        iv,
        idConseiller,
        type: 'AUTO_DESINSCRIPTION',
        infoSession: {
          id: session.id,
          titre: session.nom,
          motifAnnulation: motif
        }
      },
      { sentByBeneficiaire: true }
    )
  }
}

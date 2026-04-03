import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { CommandHandler } from 'src/building-blocks/types/command-handler'
import { Result, failure } from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { Evenement, EvenementService } from 'src/domain/evenement'
import {
  FormulaireImmersionPayloadV3,
  ImmersionClient
} from 'src/infrastructure/clients/immersion-client'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { PartenaireImmersion } from '../../infrastructure/repositories/dto/immersion.dto'
import ContactMode = PartenaireImmersion.ContactMode

export interface EnvoyerFormulaireContactImmersionCommandV3 {
  idJeune: string
  codeRome: string
  labelRome: string
  siret: string
  locationId: string
  prenom: string
  nom: string
  email: string
  numeroTelephone?: string
  contactMode: string
  message?: string
  periodeVoulue?: string
}

@Injectable()
export class EnvoyerFormulaireContactImmersionCommandHandlerV3 extends CommandHandler<
  EnvoyerFormulaireContactImmersionCommandV3,
  void
> {
  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly immersionClient: ImmersionClient,
    private readonly evenementService: EvenementService,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {
    super('CreateContactImmersionCommandHandler')
  }

  async authorize(
    command: EnvoyerFormulaireContactImmersionCommandV3,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: EnvoyerFormulaireContactImmersionCommandV3
  ): Promise<Result> {
    const appellationCode = await this.getAppellationCodeFromLabel(
      command.labelRome
    )

    const defaultMessage =
      'Bonjour, Je souhaiterais passer quelques jours dans votre entreprise en immersion professionnelle auprès de vos salariés pour découvrir ce métier. Pourriez-vous me proposer un rendez-vous ? Je pourrais alors vous expliquer directement mon projet.'

    if (!appellationCode) {
      return failure(new NonTrouveError('Offre Immersion', command.labelRome))
    }

    const params: FormulaireImmersionPayloadV3 = {
      appellationCode: appellationCode,
      siret: command.siret,
      locationId: command.locationId,
      potentialBeneficiaryFirstName: command.prenom,
      potentialBeneficiaryLastName: command.nom,
      potentialBeneficiaryEmail: command.email,
      potentialBeneficiaryPhone: command.numeroTelephone ?? '0600000000',
      immersionObjective: "Découvrir un métier ou un secteur d'activité",
      contactMode: command.contactMode as ContactMode,
      datePreferences: command.periodeVoulue,
      kind: 'IF',
      experienceAdditionalInformation: command.message ?? defaultMessage
    }

    return this.immersionClient.envoyerFormulaireImmersionV3(params)
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.OFFRE_IMMERSION_ENVOI_FORMULAIRE,
      utilisateur
    )
  }

  async getAppellationCodeFromLabel(label: string): Promise<string> {
    const metiers: Array<{ appellation_code: string }> =
      await this.sequelize.query(
        `SELECT appellation_code
       FROM "referentiel_metier_rome"
       WHERE libelle = ?`,
        {
          replacements: [label],
          type: QueryTypes.SELECT
        }
      )

    const appellationCode: string = metiers.map(m => m.appellation_code)[0]

    return appellationCode
  }
}

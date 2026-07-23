import { Injectable } from '@nestjs/common'
import { CommandHandler } from 'src/building-blocks/types/command-handler'
import { Result } from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { estInvite } from 'src/domain/core'
import { Evenement, EvenementService } from 'src/domain/evenement'
import {
  FormulaireImmersionPayloadV3,
  ImmersionClient
} from 'src/infrastructure/clients/immersion-client'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../authorizers/jeune-invite-authorizer'
import { PartenaireImmersion } from '../../infrastructure/repositories/dto/immersion.dto'
import ContactMode = PartenaireImmersion.ContactMode

export interface EnvoyerFormulaireContactImmersionCommandV3 {
  idJeune: string
  appellationCode: string
  siret: string
  locationId: string
  prenom: string
  nom: string
  email: string
  numeroTelephone: string
  contactMode: string
  datePreferences: string
  resumeLink?: string
  experienceAdditionalInformation?: string
}

@Injectable()
export class EnvoyerFormulaireContactImmersionCommandHandlerV3 extends CommandHandler<
  EnvoyerFormulaireContactImmersionCommandV3,
  void
> {
  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly jeuneInviteAuthorizer: JeuneInviteAuthorizer,
    private readonly immersionClient: ImmersionClient,
    private readonly evenementService: EvenementService
  ) {
    super('CreateContactImmersionCommandHandler')
  }

  // Le formulaire n'utilise que les champs saisis (nom/prénom/email) et l'API
  // externe : il ne lit aucune donnée du jeune en base. Un invité peut donc
  // contacter un employeur comme un jeune, une fois ses coordonnées renseignées.
  async authorize(
    command: EnvoyerFormulaireContactImmersionCommandV3,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (estInvite(utilisateur.structure)) {
      return this.jeuneInviteAuthorizer.autoriserLInvite(
        command.idJeune,
        utilisateur
      )
    }
    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: EnvoyerFormulaireContactImmersionCommandV3
  ): Promise<Result> {
    const params: FormulaireImmersionPayloadV3 = {
      appellationCode: command.appellationCode,
      siret: command.siret,
      locationId: command.locationId,
      potentialBeneficiaryFirstName: command.prenom,
      potentialBeneficiaryLastName: command.nom,
      potentialBeneficiaryEmail: command.email,
      potentialBeneficiaryPhone: command.numeroTelephone ?? '0600000000',
      immersionObjective: "Découvrir un métier ou un secteur d'activité",
      contactMode: command.contactMode as ContactMode,
      datePreferences: command.datePreferences,
      kind: 'IF',
      experienceAdditionalInformation: command.experienceAdditionalInformation,
      potentialBeneficiaryResumeLink: command.resumeLink
    }

    return this.immersionClient.envoyerFormulaireImmersionV3(params)
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.OFFRE_IMMERSION_ENVOI_FORMULAIRE,
      utilisateur
    )
  }
}

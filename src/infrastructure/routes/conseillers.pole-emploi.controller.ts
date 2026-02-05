import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { handleResult } from 'src/infrastructure/routes/result.handler'
import { CreerJeunePoleEmploiCommandHandler } from '../../application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import {
  EmailBeneficiaireFTQueryModel,
  VerifierEmailBeneficiaireQueryHandler
} from '../../application/queries/pole-emploi/verifier-email-beneficiaire.query.handler'
import { JeuneQueryModel } from '../../application/queries/query-models/jeunes.query-model'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import {
  CreateJeunePoleEmploiPayload,
  VerifierEmailBeneficiairePayload
} from './validation/conseillers.inputs'

@Controller('conseillers/pole-emploi')
@CustomSwaggerApiOAuth2()
@ApiTags('Conseillers Pôle emploi')
export class ConseillersPoleEmploiController {
  constructor(
    private readonly creerJeunePoleEmploiCommandHandler: CreerJeunePoleEmploiCommandHandler,
    private readonly verifierEmailBeneficiaireQueryHandler: VerifierEmailBeneficiaireQueryHandler
  ) {}

  @ApiOperation({
    summary: 'Crée un jeune PE',
    description: 'Autorisé pour un conseiller PE'
  })
  @Post('jeunes')
  @ApiResponse({
    type: JeuneQueryModel
  })
  async createJeunePoleEmploi(
    @Body() createJeunePayload: CreateJeunePoleEmploiPayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<JeuneQueryModel> {
    const result = await this.creerJeunePoleEmploiCommandHandler.execute(
      {
        ...createJeunePayload,
        idConseiller: utilisateur.id
      },
      utilisateur
    )

    return handleResult(result, jeune => ({
      id: jeune.id,
      firstName: jeune.firstName,
      lastName: jeune.lastName,
      idConseiller: jeune.conseiller!.id
    }))
  }

  /**
   * POST plutôt que GET pour éviter de logger l'email (donnée personnelle) dans les URLs.
   */
  @ApiOperation({
    summary: 'Vérifie si un email existe pour créer un bénéficiaire',
    description: 'Autorisé pour un conseiller FT sur un mail de bénéficiaire FT'
  })
  @Post('verifier-email-beneficiaire')
  @HttpCode(HttpStatus.OK)
  async verifierEmailBeneficiaire(
    @Body() payload: VerifierEmailBeneficiairePayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<EmailBeneficiaireFTQueryModel> {
    const result = await this.verifierEmailBeneficiaireQueryHandler.execute(
      payload,
      utilisateur
    )

    return handleResult(result)
  }
}

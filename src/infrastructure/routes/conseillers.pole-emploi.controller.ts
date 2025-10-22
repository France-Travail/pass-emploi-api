import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { handleResult } from 'src/infrastructure/routes/result.handler'
import { CreerJeunePoleEmploiCommandHandler } from '../../application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import { JeuneQueryModel } from '../../application/queries/query-models/jeunes.query-model'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { CreateJeunePoleEmploiPayload } from './validation/conseillers.inputs'

@Controller('conseillers/pole-emploi')
@CustomSwaggerApiOAuth2()
@ApiTags('Conseillers Pôle emploi')
export class ConseillersPoleEmploiController {
  constructor(
    private readonly creerJeunePoleEmploiCommandHandler: CreerJeunePoleEmploiCommandHandler
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
        ...createJeunePayload
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
}

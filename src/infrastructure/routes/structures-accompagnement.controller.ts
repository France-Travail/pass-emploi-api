import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GetStructuresAccompagnementQueryHandler } from '../../application/queries/get-structures-accompagnement.query.handler'
import { StructureAccompagnementQueryModel } from '../../application/queries/query-models/structures-accompagnement.query-model'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { UserJourney } from '../monitoring/user-journey.decorator'
import { handleResult } from './result.handler'
import { GetStructuresAccompagnementQueryParams } from './validation/structures-accompagnement.inputs'

@Controller('structures-accompagnement')
@UserJourney('structures_accompagnement')
@CustomSwaggerApiOAuth2()
@ApiTags('Jeunes Invité')
export class StructuresAccompagnementController {
  constructor(
    private readonly getStructuresAccompagnementQueryHandler: GetStructuresAccompagnementQueryHandler
  ) {}

  @ApiOperation({
    summary:
      "Récupère la Mission Locale ou les agences France Travail de la commune de l'invité",
    description: 'Réservé au mode invité'
  })
  @Get()
  @ApiResponse({ type: StructureAccompagnementQueryModel, isArray: true })
  async getStructuresAccompagnement(
    @Query() params: GetStructuresAccompagnementQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<StructureAccompagnementQueryModel[]> {
    const result = await this.getStructuresAccompagnementQueryHandler.execute(
      {
        type: params.type,
        codeInsee: params.codeInsee,
        codePostal: params.codePostal
      },
      utilisateur
    )

    return handleResult(result)
  }
}

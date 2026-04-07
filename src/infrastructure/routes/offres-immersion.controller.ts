import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  SetMetadata,
  UseGuards
} from '@nestjs/common'
import { ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { EnvoyerFormulaireContactImmersionCommandHandler } from '../../application/commands/envoyer-formulaire-contact-immersion.command.handler.db'
import { NotifierNouvellesImmersionsCommandHandler } from '../../application/commands/notifier-nouvelles-immersions.command.handler'
import {
  GetDetailOffreImmersionQuery,
  GetDetailOffreImmersionQueryHandler
} from '../../application/queries/get-detail-offre-immersion.query.handler'
import {
  GetOffresImmersionQuery,
  GetOffresImmersionQueryHandler
} from '../../application/queries/get-offres-immersion.query.handler'
import {
  DetailOffreImmersionQueryModel,
  DetailOffreImmersionQueryModelV3,
  OffreImmersionQueryModel,
  OffreImmersionQueryModelV3
} from '../../application/queries/query-models/offres-immersion.query-model'
import { Authentification } from '../../domain/authentification'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import {
  GetOffresImmersionQueryParams,
  NouvellesOffresImmersions,
  PostImmersionContactBody,
  PostImmersionContactBodyV3
} from './validation/offres-immersion.inputs'
import {
  GetDetailOffreImmersionQueryHandlerV3,
  GetDetailOffreImmersionQueryV3
} from '../../application/queries/get-detail-offre-immersionV3.query.handler'
import { EnvoyerFormulaireContactImmersionCommandHandlerV3 } from '../../application/commands/envoyer-formulaire-contact-immersionV3.command.handler.db'
import { GetOffresImmersionQueryHandlerV3 } from '../../application/queries/get-offres-immersionV3.query.handler'

@Controller()
@CustomSwaggerApiOAuth2()
@ApiTags("Offres d'immersion")
export class OffresImmersionController {
  constructor(
    private readonly getDetailOffreImmersionQueryHandler: GetDetailOffreImmersionQueryHandler,
    private readonly getDetailOffreImmersionQueryHandlerV3: GetDetailOffreImmersionQueryHandlerV3,
    private readonly getOffresImmersionQueryHandler: GetOffresImmersionQueryHandler,
    private readonly getOffresImmersionQueryHandlerV3: GetOffresImmersionQueryHandlerV3,
    private readonly notifierNouvellesImmersionsCommandHandler: NotifierNouvellesImmersionsCommandHandler,
    private readonly envoyerFormulaireContactImmersionCommandHandler: EnvoyerFormulaireContactImmersionCommandHandler,
    private readonly envoyerFormulaireContactImmersionCommandHandlerV3: EnvoyerFormulaireContactImmersionCommandHandlerV3
  ) {}

  @Get('offres-immersion')
  @ApiResponse({
    type: OffreImmersionQueryModel,
    isArray: true
  })
  async getOffresImmersion(
    @Query() getOffresImmersionQueryParams: GetOffresImmersionQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<OffreImmersionQueryModel[]> {
    const query: GetOffresImmersionQuery = {
      rome: getOffresImmersionQueryParams.rome,
      lat: getOffresImmersionQueryParams.lat,
      lon: getOffresImmersionQueryParams.lon,
      distance: getOffresImmersionQueryParams.distance
    }

    const result = await this.getOffresImmersionQueryHandler.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @Get('v3/offres-immersion')
  @ApiResponse({
    type: OffreImmersionQueryModelV3,
    isArray: true
  })
  async getOffresImmersionV3(
    @Query() getOffresImmersionQueryParams: GetOffresImmersionQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<OffreImmersionQueryModelV3[]> {
    const query: GetOffresImmersionQuery = {
      rome: getOffresImmersionQueryParams.rome,
      lat: getOffresImmersionQueryParams.lat,
      lon: getOffresImmersionQueryParams.lon,
      distance: getOffresImmersionQueryParams.distance
    }

    const result = await this.getOffresImmersionQueryHandlerV3.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @Get('offres-immersion/:idOffreImmersion')
  @ApiResponse({
    type: DetailOffreImmersionQueryModel
  })
  async getDetailOffreImmersion(
    @Param('idOffreImmersion') idOffreImmersion: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DetailOffreImmersionQueryModel | undefined> {
    const query: GetDetailOffreImmersionQuery = {
      idOffreImmersion
    }
    const result = await this.getDetailOffreImmersionQueryHandler.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @Get('v3/offres-immersion/:idOffreImmersion')
  @ApiResponse({
    type: DetailOffreImmersionQueryModelV3
  })
  async getDetailOffreImmersionV3(
    @Param('idOffreImmersion') idOffreImmersion: string,
    @Query('locationId') locationId: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DetailOffreImmersionQueryModelV3 | undefined> {
    const query: GetDetailOffreImmersionQueryV3 = {
      idOffreImmersion,
      locationId
    }
    const result = await this.getDetailOffreImmersionQueryHandlerV3.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @SkipOidcAuth()
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api_key')
  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.IMMERSION
  )
  @Post('offres-immersion')
  @HttpCode(202)
  async notifierNouvellesImmersions(
    @Body() nouvellesImmersions: NouvellesOffresImmersions
  ): Promise<void> {
    this.notifierNouvellesImmersionsCommandHandler.execute({
      immersions: nouvellesImmersions.immersions
    })
  }

  @Post('jeunes/:idJeune/offres-immersion/contact')
  async postFormulaireImmersion(
    @Param('idJeune') idJeune: string,
    @Body() postImmersionContactBody: PostImmersionContactBody,
    @Utilisateur()
    utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result =
      await this.envoyerFormulaireContactImmersionCommandHandler.execute(
        {
          idJeune,
          ...postImmersionContactBody
        },
        utilisateur
      )

    return handleResult(result)
  }

  @Post('v3/jeunes/:idJeune/offres-immersion/contact')
  async postFormulaireImmersionV3(
    @Param('idJeune') idJeune: string,
    @Body() postImmersionContactBody: PostImmersionContactBodyV3,
    @Utilisateur()
    utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result =
      await this.envoyerFormulaireContactImmersionCommandHandlerV3.execute(
        {
          idJeune,
          ...postImmersionContactBody
        },
        utilisateur
      )

    return handleResult(result)
  }
}

import { UserJourney } from '../monitoring/user-journey.decorator'
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
import { NotifierNouvellesImmersionsCommandHandler } from '../../application/commands/notifier-nouvelles-immersions.command.handler'
import {
  DetailOffreImmersionQueryModelV3,
  ResultatRechercheOffresImmersionQueryModelV3
} from '../../application/queries/query-models/offres-immersion.query-model'
import { Authentification } from '../../domain/authentification'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import {
  GetOffresImmersionQueryParamsV3,
  NouvellesOffresImmersions,
  PostImmersionContactBodyV3
} from './validation/offres-immersion.inputs'
import {
  GetDetailOffreImmersionQueryHandlerV3,
  GetDetailOffreImmersionQueryV3
} from '../../application/queries/get-detail-offre-immersionV3.query.handler'
import { EnvoyerFormulaireContactImmersionCommandHandlerV3 } from '../../application/commands/envoyer-formulaire-contact-immersionV3.command.handler.db'
import {
  GetOffresImmersionQueryHandlerV3,
  GetOffresImmersionQueryV3
} from '../../application/queries/get-offres-immersionV3.query.handler'

@Controller()
@UserJourney('recherche_offres')
@CustomSwaggerApiOAuth2()
@ApiTags("Offres d'immersion")
export class OffresImmersionController {
  constructor(
    private readonly getDetailOffreImmersionQueryHandlerV3: GetDetailOffreImmersionQueryHandlerV3,
    private readonly getOffresImmersionQueryHandlerV3: GetOffresImmersionQueryHandlerV3,
    private readonly notifierNouvellesImmersionsCommandHandler: NotifierNouvellesImmersionsCommandHandler,
    private readonly envoyerFormulaireContactImmersionCommandHandlerV3: EnvoyerFormulaireContactImmersionCommandHandlerV3
  ) {}

  @Get('offres-immersion/v3')
  @ApiResponse({
    type: ResultatRechercheOffresImmersionQueryModelV3
  })
  async getOffresImmersionV3(
    @Query() getOffresImmersionQueryParams: GetOffresImmersionQueryParamsV3,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<ResultatRechercheOffresImmersionQueryModelV3> {
    const query: GetOffresImmersionQueryV3 = {
      rome: getOffresImmersionQueryParams.rome,
      appellationCode: getOffresImmersionQueryParams.appellationCode,
      lat: getOffresImmersionQueryParams.lat,
      lon: getOffresImmersionQueryParams.lon,
      distance: getOffresImmersionQueryParams.distance,
      currentPage: getOffresImmersionQueryParams.page,
      numberPerPage: getOffresImmersionQueryParams.limit
    }

    const result = await this.getOffresImmersionQueryHandlerV3.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @Get('offres-immersion/v3/:siret/:appellationCode/:locationId')
  @ApiResponse({
    type: DetailOffreImmersionQueryModelV3
  })
  async getDetailOffreImmersionV3(
    @Param('siret') siret: string,
    @Param('appellationCode') appellationCode: string,
    @Param('locationId') locationId: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DetailOffreImmersionQueryModelV3 | undefined> {
    const query: GetDetailOffreImmersionQueryV3 = {
      siret,
      appellationCode,
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

  @Post('jeunes/:idJeune/offres-immersion/v3/contact')
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

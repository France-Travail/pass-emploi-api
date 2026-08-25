import { UserJourney } from '../monitoring/user-journey.decorator'
import { Controller, Get, GoneException, Param, Query } from '@nestjs/common'
import { ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional } from 'class-validator'
import {
  DiagorienteMetiersFavorisQueryModel,
  GetDiagorienteMetiersFavorisQueryHandler
} from '../../application/queries/get-diagoriente-metiers-favoris.query.handler'
import {
  DiagorienteUrlsQueryModel,
  GetDiagorienteUrlsQueryHandler
} from '../../application/queries/get-diagoriente-urls.query.handler'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import { transformStringToBoolean } from './validation/utils/transformers'
import { ConfigService } from '@nestjs/config'

class GetDiagorienteMetiersFavorisQueryParams {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @IsIn([true, false])
  @Transform(params => transformStringToBoolean(params, 'detail'))
  detail?: boolean
}

@Controller('jeunes/:idJeune/diagoriente')
@UserJourney('diagoriente')
@CustomSwaggerApiOAuth2()
@ApiTags('Diagoriente')
export class DiagorienteController {
  private readonly isDisabled: boolean
  constructor(
    private readonly getDiagorienteUrlsQueryHandler: GetDiagorienteUrlsQueryHandler,
    private readonly getDiagorienteMetiersFavorisQueryHandler: GetDiagorienteMetiersFavorisQueryHandler,
    private readonly config: ConfigService
  ) {
    this.isDisabled = this.config.get('diagoriente').disabled
  }

  @Get('urls')
  @ApiResponse({
    type: DiagorienteUrlsQueryModel
  })
  async getDiagorienteUrlChatbot(
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DiagorienteUrlsQueryModel> {
    if (this.isDisabled) throw new GoneException()
    const result = await this.getDiagorienteUrlsQueryHandler.execute(
      {
        idJeune
      },
      utilisateur
    )

    return handleResult(result)
  }

  @Get('metiers-favoris')
  @ApiResponse({
    type: DiagorienteMetiersFavorisQueryModel
  })
  async getDiagorienteMetiersFavoris(
    @Param('idJeune') idJeune: string,
    @Query()
    getDiagorienteMetiersFavorisQueryParams: GetDiagorienteMetiersFavorisQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DiagorienteMetiersFavorisQueryModel> {
    if (this.isDisabled) throw new GoneException()
    const result = await this.getDiagorienteMetiersFavorisQueryHandler.execute(
      {
        idJeune,
        detail: getDiagorienteMetiersFavorisQueryParams.detail
      },
      utilisateur
    )

    return handleResult(result)
  }
}

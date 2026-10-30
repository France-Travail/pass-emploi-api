import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  GetReferentielRomePocOrientationQuery,
  GetReferentielRomePocOrientationQueryHandler
} from '../../application/queries/get-referentiel-rome-poc-orientation.query.handler'
import { Public } from '../decorators/public.decorator'
import { handleResult } from './result.handler'
import {
  CodeCentreInteretRomeParams,
  CodeMetierRomeParams
} from './validation/poc-orientation.inputs'

@Controller('referentiels/rome')
@ApiTags('POC orientation')
export class PocOrientationController {
  constructor(
    private readonly getReferentielRomePocOrientationQueryHandler: GetReferentielRomePocOrientationQueryHandler
  ) {}

  @Get('centres-interet')
  @Public()
  async getCentresInteret(): Promise<unknown> {
    return this.relayer({ ressource: 'CENTRES_INTERET' })
  }

  @Get('centres-interet/:code/metiers')
  @Public()
  async getMetiersDuCentreInteret(
    @Param() params: CodeCentreInteretRomeParams
  ): Promise<unknown> {
    return this.relayer({
      ressource: 'METIERS_DU_CENTRE_INTERET',
      code: params.code
    })
  }

  @Get('metiers')
  @Public()
  async getMetiers(): Promise<unknown> {
    return this.relayer({ ressource: 'METIERS' })
  }

  @Get('metiers/:code')
  @Public()
  async getFicheMetier(
    @Param() params: CodeMetierRomeParams
  ): Promise<unknown> {
    return this.relayer({ ressource: 'FICHE_METIER', code: params.code })
  }

  private async relayer(
    query: GetReferentielRomePocOrientationQuery
  ): Promise<unknown> {
    const result =
      await this.getReferentielRomePocOrientationQueryHandler.execute(query)
    return handleResult(result)
  }
}

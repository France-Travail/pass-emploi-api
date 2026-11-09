import { UserJourney } from '../monitoring/user-journey.decorator'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UpdateCGUInviteCommandHandler } from '../../application/commands/update-cgu-invite.command.handler.db'
import { UpdatePrenomInviteCommandHandler } from '../../application/commands/update-prenom-invite.command.handler.db'
import {
  CGUInviteQueryModel,
  GetCGUInviteQueryHandler
} from '../../application/queries/get-cgu-invite.query.handler.db'
import {
  GetPrenomInviteQueryHandler,
  PrenomInviteQueryModel
} from '../../application/queries/get-prenom-invite.query.handler.db'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import {
  PutCGUInvitePayload,
  PutPrenomInvitePayload
} from './validation/jeunes.invite.inputs'

@Controller('jeunes')
@UserJourney('invitation_jeune')
@CustomSwaggerApiOAuth2()
@ApiTags('Jeunes Invité')
export class JeunesInviteController {
  constructor(
    private readonly getPrenomInviteQueryHandler: GetPrenomInviteQueryHandler,
    private readonly updatePrenomInviteCommandHandler: UpdatePrenomInviteCommandHandler,
    private readonly getCGUInviteQueryHandler: GetCGUInviteQueryHandler,
    private readonly updateCGUInviteCommandHandler: UpdateCGUInviteCommandHandler
  ) {}

  @ApiOperation({
    summary: "Récupère le prénom d'affichage de l'invité",
    description: 'Réservé au mode invité'
  })
  @Get(':idJeune/invite/prenom')
  @ApiResponse({ type: PrenomInviteQueryModel })
  async getPrenom(
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<PrenomInviteQueryModel> {
    const result = await this.getPrenomInviteQueryHandler.execute(
      { idJeune },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Met à jour le prénom d'affichage de l'invité",
    description:
      'Réservé au mode invité. Le JWT reprendra la valeur au refresh suivant.'
  })
  @Put(':idJeune/invite/prenom')
  @HttpCode(HttpStatus.NO_CONTENT)
  async putPrenom(
    @Param('idJeune') idJeune: string,
    @Body() payload: PutPrenomInvitePayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.updatePrenomInviteCommandHandler.execute(
      { idJeune, prenom: payload.prenom },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Récupère la date de signature des CGU de l'invité",
    description:
      "Réservé au mode invité. dateSignatureCGU est absente si l'invité ne les a pas encore signées."
  })
  @Get(':idJeune/invite/cgu')
  @ApiResponse({ type: CGUInviteQueryModel })
  async getCGU(
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<CGUInviteQueryModel> {
    const result = await this.getCGUInviteQueryHandler.execute(
      { idJeune },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Enregistre la date de signature des CGU de l'invité",
    description: 'Réservé au mode invité'
  })
  @Put(':idJeune/invite/cgu')
  @HttpCode(HttpStatus.NO_CONTENT)
  async putCGU(
    @Param('idJeune') idJeune: string,
    @Body() payload: PutCGUInvitePayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.updateCGUInviteCommandHandler.execute(
      { idJeune, dateSignatureCGU: payload.dateSignatureCGU },
      utilisateur
    )

    return handleResult(result)
  }
}

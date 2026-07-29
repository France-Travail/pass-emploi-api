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
import { UpdatePrenomInviteCommandHandler } from '../../application/commands/update-prenom-invite.command.handler.db'
import {
  GetPrenomInviteQueryHandler,
  PrenomInviteQueryModel
} from '../../application/queries/get-prenom-invite.query.handler.db'
import { Authentification } from '../../domain/authentification'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { AutoriseLesInvites } from '../decorators/autorise-les-invites.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import { PutPrenomInvitePayload } from './validation/jeunes.invite.inputs'

@Controller('jeunes')
@CustomSwaggerApiOAuth2()
@ApiTags('Jeunes Invité')
@AutoriseLesInvites()
export class JeunesInviteController {
  constructor(
    private readonly getPrenomInviteQueryHandler: GetPrenomInviteQueryHandler,
    private readonly updatePrenomInviteCommandHandler: UpdatePrenomInviteCommandHandler
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
}

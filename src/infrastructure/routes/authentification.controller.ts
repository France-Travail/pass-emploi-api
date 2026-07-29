import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  SetMetadata,
  UseGuards
} from '@nestjs/common'
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import { UpdateUtilisateurInviteCommandHandler } from '../../application/commands/update-utilisateur-invite.command.handler'
import {
  UpdateUtilisateurCommand,
  UpdateUtilisateurCommandHandler
} from '../../application/commands/update-utilisateur.command.handler'
import { GetChatSecretsQueryHandler } from '../../application/queries/get-chat-secrets.query.handler'
import { GetUtilisateurQueryHandler } from '../../application/queries/get-utilisateur.query.handler'
import {
  ChatSecretsQueryModel,
  UtilisateurQueryModel
} from '../../application/queries/query-models/authentification.query-model'
import { Authentification } from '../../domain/authentification'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import {
  GetUtilisateurQueryParams,
  PutUtilisateurPayload
} from './validation/authentification.inputs'

@Controller('auth')
@ApiTags('Authentification')
export class AuthentificationController {
  constructor(
    private updateUtilisateurCommandHandler: UpdateUtilisateurCommandHandler,
    private updateUtilisateurInviteCommandHandler: UpdateUtilisateurInviteCommandHandler,
    private getUtilisateurQueryHandler: GetUtilisateurQueryHandler,
    private getChatSecretsQueryHandler: GetChatSecretsQueryHandler
  ) {}

  @SkipOidcAuth()
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api_key')
  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.KEYCLOAK
  )
  @ApiOperation({
    summary:
      "Mode invité : crée le jeune invité s'il n'existe pas, sinon renvoie l'existant (idempotent)"
  })
  @Put('users/invite/:idAuthentification')
  @ApiResponse({
    type: UtilisateurQueryModel
  })
  async putUtilisateurInvite(
    // Contrairement aux autres structures, l'idAuthentification d'un invité
    // n'est pas un sub d'IDP tiers subi mais un uuid v4 fabriqué par Connect :
    // on peut donc l'imposer. Un appel malformé échoue en 400 plutôt que de
    // créer un invité orphelin impossible à retrouver.
    @Param('idAuthentification', new ParseUUIDPipe({ version: '4' }))
    idAuthentification: string
  ): Promise<UtilisateurQueryModel> {
    const result = await this.updateUtilisateurInviteCommandHandler.execute({
      idUtilisateurAuth: idAuthentification
    })

    return handleResult(result)
  }

  @SkipOidcAuth()
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api_key')
  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.KEYCLOAK
  )
  @ApiOperation({
    summary:
      "Récupère un utilisateur jeune/conseiller, crée le conseiller PE/Milo si il n'existe pas"
  })
  @Put('users/:idAuthentification')
  @ApiResponse({
    type: UtilisateurQueryModel
  })
  async putUtilisateur(
    @Param('idAuthentification') idAuthentification: string,
    @Body() updateUserPayload: PutUtilisateurPayload
  ): Promise<UtilisateurQueryModel> {
    const command: UpdateUtilisateurCommand = {
      ...updateUserPayload,
      idUtilisateurAuth: idAuthentification
    }
    const result = await this.updateUtilisateurCommandHandler.execute(command)

    return handleResult(result)
  }

  @SkipOidcAuth()
  @UseGuards(ApiKeyAuthGuard)
  @ApiSecurity('api_key')
  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.KEYCLOAK
  )
  @ApiOperation({
    summary: 'Récupère un utilisateur jeune/conseiller'
  })
  @Get('users/:idAuthentification')
  @ApiResponse({
    type: UtilisateurQueryModel
  })
  async getUtilisateur(
    @Param('idAuthentification') idAuthentification: string,
    @Query() queryParams: GetUtilisateurQueryParams
  ): Promise<UtilisateurQueryModel> {
    const result = await this.getUtilisateurQueryHandler.execute({
      idAuthentification: idAuthentification,
      typeUtilisateur: queryParams.typeUtilisateur,
      structureUtilisateur: queryParams.structureUtilisateur
    })

    return handleResult(result)
  }

  @ApiOperation({
    summary: 'Récupère le token et la clé de chiffrement du chat du jeune'
  })
  @Post('firebase/token')
  @CustomSwaggerApiOAuth2()
  async postFirebaseToken(
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<ChatSecretsQueryModel> {
    const queryModel = await this.getChatSecretsQueryHandler.execute({
      utilisateur
    })

    if (queryModel) {
      return queryModel
    }

    throw new HttpException(
      `Could not find chat secrets`,
      HttpStatus.INTERNAL_SERVER_ERROR
    )
  }
}

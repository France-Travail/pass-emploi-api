import { Controller, Get, Param, SetMetadata, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import { failure, success } from '../../building-blocks/types/result'
import { ArchiveJeune } from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { FirebaseClient } from '../clients/firebase-client'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { handleResult } from './result.handler'

@Controller('admin')
@ApiTags('Admin')
@SkipOidcAuth()
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('api_key')
export class AdminController {
  constructor(
    private readonly firebaseClient: FirebaseClient,
    private readonly configService: ConfigService
  ) {}

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.ADMIN
  )
  @ApiOperation({
    summary: "Récupère le chat d'un bénéficiaire",
    description: 'Autorisé pour le support - Activation requise'
  })
  @Get('chat/:idJeune')
  async getChat(
    @Param('idJeune') idJeune: string
  ): Promise<ArchiveJeune.Message[]> {
    if (!this.configService.get<boolean>('features.activerRecuperationChat')) {
      return handleResult(
        failure(
          new DroitsInsuffisants(
            'La récupération des chats est désactivée. Veuillez contacter un administrateur.'
          )
        )
      )
    }
    const messages = await this.firebaseClient.getChatAArchiver(idJeune)

    return handleResult(
      success(
        messages.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      )
    )
  }
}

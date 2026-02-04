import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import {
  CreateActualiteMiloCommand,
  CreateActualiteMiloCommandHandler
} from '../../application/commands/milo/create-actualite-milo.command.handler'
import { ActualiteMiloQueryModel } from '../../application/queries/query-models/actualite-milo.query-model'
import { Authentification } from '../../domain/authentification'
import { ActualiteMilo } from '../../domain/milo/actualite.milo'
import { Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import { CreateActualiteMiloPayload } from './validation/actualites.milo.inputs'

@Controller('structures-milo')
@CustomSwaggerApiOAuth2()
@ApiTags('Actualites Milo')
export class ActualitesMiloController {
  constructor(
    private readonly createActualiteMiloCommandHandler: CreateActualiteMiloCommandHandler
  ) {}

  @ApiOperation({
    summary: 'Crée une actualité pour la structure MILO',
    description: 'Autorisé pour un conseiller MILO de la structure'
  })
  @Post(':idStructureMilo/actualites')
  @ApiResponse({ type: ActualiteMiloQueryModel })
  async createActualite(
    @Param('idStructureMilo') idStructureMilo: string,
    @Body() payload: CreateActualiteMiloPayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<ActualiteMiloQueryModel> {
    const command: CreateActualiteMiloCommand = {
      idStructureMilo,
      nomPrenomConseiller: `${utilisateur.prenom} ${utilisateur.nom}`,
      titre: payload.titre,
      contenu: payload.contenu,
      titreLien: payload.titreLien,
      lien: payload.lien
    }

    const result = await this.createActualiteMiloCommandHandler.execute(
      command,
      utilisateur
    )

    return handleResult(result, toActualiteMiloQueryModel)
  }
}

function toActualiteMiloQueryModel(
  actualite: ActualiteMilo
): ActualiteMiloQueryModel {
  return {
    id: actualite.id,
    titre: actualite.titre,
    contenu: actualite.contenu,
    titreLien: actualite.titreLien,
    lien: actualite.lien,
    dateCreation: actualite.dateCreation.toISO(),
    dateModification: actualite.dateModification?.toISO()
  }
}

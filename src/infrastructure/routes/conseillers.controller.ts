import { UserJourney } from '../monitoring/user-journey.decorator'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res
} from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { DateTime } from 'luxon'
import { RendezVousJeuneQueryModel } from 'src/application/queries/query-models/rendez-vous.query-model'
import { GetRendezVousJeuneQueryHandler } from 'src/application/queries/rendez-vous/get-rendez-vous-jeune.query.handler.db'
import { GetRendezVousJeuneConseillerQueryParams } from 'src/infrastructure/routes/validation/jeunes.inputs'
import { DeleteConseillerCommandHandler } from '../../application/commands/conseiller/delete-conseiller.command.handler'
import { ModifierConseillerCommandHandler } from '../../application/commands/conseiller/modifier-conseiller.command.handler'
import {
  CreateListeDeDiffusionCommand,
  CreateListeDeDiffusionCommandHandler
} from '../../application/commands/create-liste-de-diffusion.command.handler'
import { EnvoyerEmailActivationCommandHandler } from '../../application/commands/milo/envoyer-email-activation.command.handler'
import { ChangerDispositifJeuneCommandHandler } from '../../application/commands/changer-dispositif-jeune.command.handler'
import { ModifierJeuneDuConseillerCommandHandler } from '../../application/commands/modifier-jeune-du-conseiller.command.handler'
import { RecupererJeunesDuConseillerCommandHandler } from '../../application/commands/recuperer-jeunes-du-conseiller.command.handler'
import {
  SendNotificationsNouveauxMessagesCommand,
  SendNotificationsNouveauxMessagesCommandHandler
} from '../../application/commands/send-notifications-nouveaux-messages.command.handler'
import {
  ComptageJeunesQueryModel,
  GetComptageJeunesByConseillerQueryHandler
} from '../../application/queries/get-comptage-jeunes-by-conseiller.query.handler.db'
import { GetConseillersQueryHandler } from '../../application/queries/get-conseillers.query.handler.db'
import { GetDemarchesConseillerQueryHandler } from '../../application/queries/get-demarches-conseiller.query.handler'
import {
  EmailJeuneQueryModel,
  VerifierEmailJeuneQueryHandler
} from '../../application/queries/verifier-email-jeune.query.handler'
import { GetDetailConseillerQueryHandler } from '../../application/queries/get-detail-conseiller.query.handler.db'
import {
  GetImpactChangementDispositifQueryHandler,
  ImpactChangementDispositifQueryModel
} from '../../application/queries/get-impact-changement-dispositif.query.handler.db'
import { GetIndicateursPourConseillerQueryHandler } from '../../application/queries/get-indicateurs-pour-conseiller.query.handler.db'
import { GetJeunesByConseillerQueryHandler } from '../../application/queries/get-jeunes-by-conseiller.query.handler.db'
import { GetJeunesIdentitesQueryHandler } from '../../application/queries/get-jeunes-identites.query.handler.db'
import { DemarcheQueryModel } from '../../application/queries/query-models/actions.query-model'
import {
  ConseillerSimpleQueryModel,
  DetailConseillerQueryModel
} from '../../application/queries/query-models/conseillers.query-model'
import { IndicateursPourConseillerQueryModel } from '../../application/queries/query-models/indicateurs-pour-conseiller.query-model'
import {
  DetailJeuneConseillerQueryModel,
  IdentiteJeuneQueryModel
} from '../../application/queries/query-models/jeunes.query-model'
import { Cached } from '../../building-blocks/types/query'
import { Authentification } from '../../domain/authentification'
import { AccessToken, Utilisateur } from '../decorators/authenticated.decorator'
import { CustomSwaggerApiOAuth2 } from '../decorators/swagger.decorator'
import { handleResult } from './result.handler'
import {
  ChangerDispositifJeunePayload,
  CreateListeDeDiffusionPayload,
  DetailConseillerPayload,
  EnvoyerNotificationsPayload,
  VerifierEmailJeunePayload,
  GetConseillersQueryParams,
  GetDemarchesConseillerQueryParams,
  GetIdentitesJeunesQueryParams,
  GetIndicateursPourConseillerQueryParams,
  UpdateJeuneDuConseillerPayload
} from './validation/conseillers.inputs'

@Controller('conseillers')
@UserJourney('portefeuille_conseiller')
@CustomSwaggerApiOAuth2()
@ApiTags('Conseillers')
export class ConseillersController {
  constructor(
    private readonly getDetailConseillerQueryHandler: GetDetailConseillerQueryHandler,
    private readonly getConseillersQueryHandler: GetConseillersQueryHandler,
    private readonly getJeunesByConseillerQueryHandler: GetJeunesByConseillerQueryHandler,
    private readonly getComptageJeunesByConseillerQueryHandler: GetComptageJeunesByConseillerQueryHandler,
    private readonly modifierConseillerCommandHandler: ModifierConseillerCommandHandler,
    private readonly recupererJeunesDuConseillerCommandHandler: RecupererJeunesDuConseillerCommandHandler,
    private readonly modifierJeuneDuConseillerCommandHandler: ModifierJeuneDuConseillerCommandHandler,
    private readonly getIndicateursPourConseillerQueryHandler: GetIndicateursPourConseillerQueryHandler,
    private readonly createListeDeDiffusionCommandHandler: CreateListeDeDiffusionCommandHandler,
    private readonly getIdentitesJeunesQueryHandler: GetJeunesIdentitesQueryHandler,
    private readonly deleteConseillerCommandHandler: DeleteConseillerCommandHandler,
    private readonly getDemarchesConseillerQueryHandler: GetDemarchesConseillerQueryHandler,
    private readonly verifierEmailJeuneQueryHandler: VerifierEmailJeuneQueryHandler,
    private readonly getImpactChangementDispositifQueryHandler: GetImpactChangementDispositifQueryHandler,
    private readonly getRendezVousJeuneQueryHandler: GetRendezVousJeuneQueryHandler,
    private readonly sendNotificationsNouveauxMessages: SendNotificationsNouveauxMessagesCommandHandler,
    private readonly envoyerEmailActivationCommandHandler: EnvoyerEmailActivationCommandHandler,
    private readonly changerDispositifJeuneCommandHandler: ChangerDispositifJeuneCommandHandler
  ) {}

  @ApiOperation({
    summary: 'Supprime un conseiller',
    description: 'Autorisé pour un conseiller'
  })
  @Delete(':idConseiller')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConseiller(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.deleteConseillerCommandHandler.execute(
      {
        idConseiller
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary:
      'Recherche des conseillers par email ou par nom/prénom dans une même structure',
    description: 'Autorisé pour un Conseiller Superviseur'
  })
  @Get()
  @ApiResponse({
    type: ConseillerSimpleQueryModel,
    isArray: true
  })
  async getConseillers(
    @Query() queryParams: GetConseillersQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<ConseillerSimpleQueryModel[]> {
    const result = await this.getConseillersQueryHandler.execute(
      {
        recherche: queryParams.q
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: 'Récupère un conseiller',
    description: 'Autorisé pour un conseiller'
  })
  @Get(':idConseiller')
  @ApiResponse({
    type: DetailConseillerQueryModel
  })
  async getDetailConseiller(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @AccessToken() accessToken: string
  ): Promise<DetailConseillerQueryModel> {
    const result = await this.getDetailConseillerQueryHandler.execute(
      {
        idConseiller,
        structure: utilisateur.profil.structure,
        accessToken: accessToken
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Récupère les jeunes d'un conseiller",
    description: 'Autorisé pour un conseiller'
  })
  @Get(':idConseiller/jeunes')
  @ApiResponse({
    type: DetailJeuneConseillerQueryModel,
    isArray: true
  })
  async getJeunes(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<DetailJeuneConseillerQueryModel[]> {
    const result = await this.getJeunesByConseillerQueryHandler.execute(
      { idConseiller },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Récupère le comptage des heures pour les jeunes d'un conseiller",
    description: 'Autorisé pour un conseiller'
  })
  @Get(':idConseiller/jeunes/comptage')
  @ApiResponse({ type: ComptageJeunesQueryModel })
  async getComptageJeunes(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @AccessToken() accessToken: string
  ): Promise<ComptageJeunesQueryModel> {
    const result = await this.getComptageJeunesByConseillerQueryHandler.execute(
      { idConseiller, accessToken },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary:
      'Bénéficiaires concernés si le conseiller change de dispositif : ceux qui le suivront et ceux qui gardent le leur',
    description: 'Autorisé pour un conseiller France Travail'
  })
  @Get(':idConseiller/changement-dispositif')
  @ApiResponse({ type: ImpactChangementDispositifQueryModel })
  async getImpactChangementDispositif(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<ImpactChangementDispositifQueryModel> {
    const result = await this.getImpactChangementDispositifQueryHandler.execute(
      { idConseiller },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary:
      "Permet d'ajouter l'agence, de choisir le dispositif (conseiller France Travail uniquement), ou de modifier les notifications sonores, la date de signature des CGU, ou la date de visionnage des actus d'un conseiller",
    description:
      'Autorisé pour un conseiller - Ne supprime pas les champs quand ils sont vides'
  })
  @Put(':idConseiller')
  @ApiResponse({
    type: DetailConseillerQueryModel
  })
  @ApiBody({
    type: DetailConseillerPayload
  })
  async modiferConseiller(
    @Param('idConseiller') idConseiller: string,
    @Body() modifierConseillerPayload: DetailConseillerPayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.modifierConseillerCommandHandler.execute(
      {
        idConseiller: idConseiller,
        agence: modifierConseillerPayload.agence,
        dispositif: modifierConseillerPayload.dispositif,
        notificationsSonores: modifierConseillerPayload.notificationsSonores,
        dateSignatureCGU: modifierConseillerPayload.dateSignatureCGU,
        dateVisionnageActus: modifierConseillerPayload.dateVisionnageActus
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary:
      'Réaffecte les jeunes transférés temporairement au conseiller initial',
    description: 'Autorisé pour un conseiller'
  })
  @Post(':idConseiller/recuperer-mes-jeunes')
  @HttpCode(200)
  async recupererJeunes(
    @Param('idConseiller') idConseiller: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.recupererJeunesDuConseillerCommandHandler.execute(
      {
        idConseiller: idConseiller
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary:
      'Réaffecte les jeunes transférés temporairement au conseiller initial',
    description: 'Autorisé pour un conseiller'
  })
  @Post(':idConseiller/envoyer-email-activation/:idJeune')
  @HttpCode(200)
  async envoyerEmailActivation(
    @Param('idConseiller') idConseiller: string,
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @AccessToken() accessToken: string
  ): Promise<void> {
    const result = await this.envoyerEmailActivationCommandHandler.execute(
      {
        idConseiller,
        idJeune,
        accessToken
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Change le dispositif d'un bénéficiaire avec transition",
    description:
      'Archive les métadonnées du compte si activé, réinitialise les dates, et bascule le dispositif. Autorisé pour le conseiller du bénéficiaire.'
  })
  @Post(':idConseiller/jeunes/:idJeune/changer-dispositif')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ type: ChangerDispositifJeunePayload })
  async changerDispositifJeune(
    @Param('idConseiller') _idConseiller: string,
    @Param('idJeune') idJeune: string,
    @Body() payload: ChangerDispositifJeunePayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.changerDispositifJeuneCommandHandler.execute(
      {
        idJeune,
        dispositif: payload.dispositif,
        motif: payload.motif,
        dateFinAccompagnement: payload.dateFinAccompagnement
      },
      utilisateur
    )
    return handleResult(result)
  }

  @ApiOperation({
    summary: "Permet de modifier certains champs d'un jeune d'un conseiller",
    description: 'Autorisé pour le conseiller'
  })
  @Patch(':idConseiller/jeunes/:idJeune')
  @ApiBody({
    type: UpdateJeuneDuConseillerPayload
  })
  async modiferJeuneDuConseiller(
    @Param('idConseiller') _idConseiller: string,
    @Param('idJeune') idJeune: string,
    @Body() updateJeuneDuConseillerPayload: UpdateJeuneDuConseillerPayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const result = await this.modifierJeuneDuConseillerCommandHandler.execute(
      {
        idPartenaire: updateJeuneDuConseillerPayload.idPartenaire,
        dispositif: updateJeuneDuConseillerPayload.dispositif,
        peutVoirLeComptageDesHeures:
          updateJeuneDuConseillerPayload.peutVoirLeComptageDesHeures,
        idJeune
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: 'Récupère les indicateurs d’un jeune pour une période donnée',
    description: 'Autorisé pour le conseiller du jeune'
  })
  @Get(':idConseiller/jeunes/:idJeune/indicateurs')
  @ApiResponse({
    type: IndicateursPourConseillerQueryModel
  })
  async getIndicateursJeunePourConseiller(
    @Param('idConseiller') idConseiller: string,
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @AccessToken() accessToken: string,
    @Query()
    getIndicateursPourConseillerQueryParams: GetIndicateursPourConseillerQueryParams
  ): Promise<IndicateursPourConseillerQueryModel> {
    const result = await this.getIndicateursPourConseillerQueryHandler.execute(
      {
        idConseiller,
        idJeune,
        periode: {
          debut: getIndicateursPourConseillerQueryParams.dateDebut,
          fin: getIndicateursPourConseillerQueryParams.dateFin
        },
        accessToken
      },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: 'Crée une liste de diffusion',
    description:
      'Autorisé pour le conseiller avec les bénéficiaires de son portefeuille.'
  })
  @Post(':idConseiller/listes-de-diffusion')
  @UserJourney('messagerie')
  async getListesDeDiffusion(
    @Param('idConseiller')
    idConseiller: string,
    @Body()
    payload: CreateListeDeDiffusionPayload,
    @Utilisateur()
    utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const command: CreateListeDeDiffusionCommand = {
      idConseiller,
      titre: payload.titre,
      idsBeneficiaires: payload.idsBeneficiaires
    }
    const result = await this.createListeDeDiffusionCommandHandler.execute(
      command,
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: 'Récupère nom et prénom de certains jeunes d’un conseiller',
    description: 'Autorisé pour un conseiller'
  })
  @Get(':idConseiller/jeunes/identites')
  async getIdentitesJeunes(
    @Param('idConseiller') idConseiller: string,
    @Query() getIdentitesJeunesQueryParams: GetIdentitesJeunesQueryParams,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<IdentiteJeuneQueryModel[]> {
    const query = {
      idConseiller,
      idsJeunes: getIdentitesJeunesQueryParams.ids
    }
    const result = await this.getIdentitesJeunesQueryHandler.execute(
      query,
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Récupère les démarches d'un jeune",
    description: 'Autorisé pour un conseiller FT et CD'
  })
  @Get(':idConseiller/jeunes/:idJeune/demarches')
  @UserJourney('suivi_demarches')
  async getDemarches(
    @Param('idConseiller') idConseiller: string,
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @AccessToken() accessToken: string,
    @Query() queryParams: GetDemarchesConseillerQueryParams,
    @Res({ passthrough: true }) response: Response
  ): Promise<Cached<DemarcheQueryModel[]>> {
    const result = await this.getDemarchesConseillerQueryHandler.execute(
      {
        idJeune,
        idConseiller,
        accessToken,
        dateDebut: queryParams.dateDebut
          ? DateTime.fromISO(queryParams.dateDebut, {
              setZone: true
            })
          : undefined,
        dateFin: queryParams.dateFin
          ? DateTime.fromISO(queryParams.dateFin, {
              setZone: true
            }).endOf('day')
          : undefined
      },
      utilisateur
    )
    const demarches = handleResult(result)

    // Seule une réponse en succès est mise en cache : une erreur (bénéficiaire
    // jamais connecté, FT indisponible…) ne doit pas être resservie 20 minutes.
    response.header('Cache-Control', 'max-age=1200')
    return demarches
  }

  @Get(':idConseiller/jeunes/:idJeune/rendezvous')
  @UserJourney('rendez_vous')
  @ApiOperation({
    summary: 'Récupère les rendez-vous d’un jeune Milo',
    description: 'Autorisé pour un jeune Milo'
  })
  @ApiResponse({
    type: RendezVousJeuneQueryModel,
    isArray: true
  })
  async getRendezVousJeune(
    @Param('idJeune') idJeune: string,
    @Utilisateur() utilisateur: Authentification.Utilisateur,
    @Query() getRendezVousQueryParams: GetRendezVousJeuneConseillerQueryParams
  ): Promise<RendezVousJeuneQueryModel[]> {
    const result = await this.getRendezVousJeuneQueryHandler.execute(
      { idJeune, ...getRendezVousQueryParams },
      utilisateur
    )

    return handleResult(result)
  }

  @ApiOperation({
    summary: "Envoie une notification d'un nouveau message à des jeunes",
    description: 'Autorisé pour un conseiller'
  })
  @Post(':idConseiller/jeunes/notify-messages')
  @UserJourney('messagerie')
  async postNotifications(
    @Param('idConseiller') idConseiller: string,
    @Body() envoyerNotificationsPayload: EnvoyerNotificationsPayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<void> {
    const command: SendNotificationsNouveauxMessagesCommand = {
      idsJeunes: envoyerNotificationsPayload.idsJeunes,
      idConseiller
    }
    const result = await this.sendNotificationsNouveauxMessages.execute(
      command,
      utilisateur
    )

    return handleResult(result)
  }

  /**
   * POST plutôt que GET pour éviter de logger l'email (donnée personnelle) dans les URLs.
   */
  @ApiOperation({
    summary: 'Vérifie si un email de jeune existe déjà',
    description: 'Autorisé pour un conseiller'
  })
  @Post('verifier-email-jeune')
  @HttpCode(HttpStatus.OK)
  @UserJourney('creation_jeune')
  async verifierEmailJeune(
    @Body() payload: VerifierEmailJeunePayload,
    @Utilisateur() utilisateur: Authentification.Utilisateur
  ): Promise<EmailJeuneQueryModel> {
    const result = await this.verifierEmailJeuneQueryHandler.execute(
      payload,
      utilisateur
    )

    return handleResult(result)
  }
}

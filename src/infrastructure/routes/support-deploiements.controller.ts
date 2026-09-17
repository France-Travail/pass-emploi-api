import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  SetMetadata,
  UseGuards
} from '@nestjs/common'
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import { DateTime } from 'luxon'
import { AjouterConseillersPopulationCommandHandler } from '../../application/commands/support/ajouter-conseillers-population.command.handler.db'
import { AjouterProfilPopulationCommandHandler } from '../../application/commands/support/ajouter-profil-population.command.handler.db'
import {
  CommunicationCreee,
  CreerCommunicationCommandHandler
} from '../../application/commands/support/creer-communication.command.handler.db'
import { ModifierCommunicationCommandHandler } from '../../application/commands/support/modifier-communication.command.handler.db'
import {
  CreerDeploiementCommandHandler,
  DeploiementCree
} from '../../application/commands/support/creer-deploiement.command.handler.db'
import { CreerFonctionnaliteCommandHandler } from '../../application/commands/support/creer-fonctionnalite.command.handler.db'
import { CreerPopulationCommandHandler } from '../../application/commands/support/creer-population.command.handler.db'
import { SupprimerCommunicationCommandHandler } from '../../application/commands/support/supprimer-communication.command.handler.db'
import { SupprimerConseillersPopulationCommandHandler } from '../../application/commands/support/supprimer-conseillers-population.command.handler.db'
import { ModifierDateDeploiementCommandHandler } from '../../application/commands/support/modifier-date-deploiement.command.handler.db'
import { SupprimerDeploiementCommandHandler } from '../../application/commands/support/supprimer-deploiement.command.handler.db'
import { SupprimerFonctionnaliteCommandHandler } from '../../application/commands/support/supprimer-fonctionnalite.command.handler.db'
import { SupprimerPopulationCommandHandler } from '../../application/commands/support/supprimer-population.command.handler.db'
import { SupprimerProfilPopulationCommandHandler } from '../../application/commands/support/supprimer-profil-population.command.handler.db'
import { GetFonctionnalitesSupportQueryHandler } from '../../application/queries/get-fonctionnalites-support.query.handler.db'
import { GetPopulationSupportQueryHandler } from '../../application/queries/get-population-support.query.handler.db'
import { GetPopulationsSupportQueryHandler } from '../../application/queries/get-populations-support.query.handler.db'
import { FonctionnalitesSupportQueryModel } from '../../application/queries/query-models/fonctionnalites.query-model'
import { PopulationSupportQueryModel } from '../../application/queries/query-models/population-support.query-model'
import { Authentification } from '../../domain/authentification'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { UserJourney } from '../monitoring/user-journey.decorator'
import { handleResult } from './result.handler'
import {
  ConseillersPopulationPayload,
  CreerCommunicationPayload,
  CreerDeploiementPayload,
  CreerFonctionnalitePayload,
  CreerPopulationPayload,
  ModifierDateDeploiementPayload,
  ModifierCommunicationPayload,
  ProfilPopulationPayload,
  SupprimerConseillersPopulationPayload
} from './validation/support.inputs'

const ReserveAuSupport = SetMetadata(
  Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
  Authentification.Partenaire.SUPPORT
)

const REPONSE_404_POPULATION = {
  status: HttpStatus.NOT_FOUND,
  description: 'La population n’existe pas'
}

@Controller('support')
@UserJourney('support')
@SkipOidcAuth()
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('api_key')
export class SupportDeploiementsController {
  constructor(
    private readonly getFonctionnalitesSupportQueryHandler: GetFonctionnalitesSupportQueryHandler,
    private readonly creerFonctionnaliteCommandHandler: CreerFonctionnaliteCommandHandler,
    private readonly supprimerFonctionnaliteCommandHandler: SupprimerFonctionnaliteCommandHandler,
    private readonly getPopulationsSupportQueryHandler: GetPopulationsSupportQueryHandler,
    private readonly getPopulationSupportQueryHandler: GetPopulationSupportQueryHandler,
    private readonly creerPopulationCommandHandler: CreerPopulationCommandHandler,
    private readonly supprimerPopulationCommandHandler: SupprimerPopulationCommandHandler,
    private readonly ajouterConseillersPopulationCommandHandler: AjouterConseillersPopulationCommandHandler,
    private readonly supprimerConseillersPopulationCommandHandler: SupprimerConseillersPopulationCommandHandler,
    private readonly ajouterProfilPopulationCommandHandler: AjouterProfilPopulationCommandHandler,
    private readonly supprimerProfilPopulationCommandHandler: SupprimerProfilPopulationCommandHandler,
    private readonly creerDeploiementCommandHandler: CreerDeploiementCommandHandler,
    private readonly modifierDateDeploiementCommandHandler: ModifierDateDeploiementCommandHandler,
    private readonly supprimerDeploiementCommandHandler: SupprimerDeploiementCommandHandler,
    private readonly creerCommunicationCommandHandler: CreerCommunicationCommandHandler,
    private readonly modifierCommunicationCommandHandler: ModifierCommunicationCommandHandler,
    private readonly supprimerCommunicationCommandHandler: SupprimerCommunicationCommandHandler
  ) {}

  @ReserveAuSupport
  @ApiTags('Support - Fonctionnalités')
  @ApiOperation({
    summary: 'Liste les fonctionnalités du référentiel',
    description: `Les ids à utiliser dans \`idFonctionnalite\` de POST /support/deploiements.

**Mode d’emploi complet, dans l’ordre :**
1. \`GET /support/populations\` pour voir ce qui existe déjà, ou \`POST /support/populations\` pour créer une cible ;
2. \`POST /support/populations/conseillers\` (emails) et/ou \`POST /support/populations/profils\` (structure × dispositif) pour la remplir ;
3. \`POST /support/deploiements\` pour activer une fonctionnalité ou programmer une migration sur cette population à une date ;
4. \`POST /support/communications\` pour prévenir les utilisateurs avant J ;
5. \`GET /support/populations/:idPopulation\` pour vérifier.`
  })
  @ApiOkResponse({ type: FonctionnalitesSupportQueryModel })
  @Get('fonctionnalites')
  async getFonctionnalites(): Promise<FonctionnalitesSupportQueryModel> {
    const result = await this.getFonctionnalitesSupportQueryHandler.execute(
      {},
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Fonctionnalités')
  @ApiOperation({
    summary: 'Crée une fonctionnalité dans le référentiel',
    description:
      'Une fonctionnalité n’est qu’un identifiant, celui que l’app lit dans GET /jeunes/:id/fonctionnalites. Elle ne fait rien tant qu’un déploiement ne la vise pas. Idempotent : rejouer avec un id existant ne change rien.'
  })
  @ApiBody({
    type: CreerFonctionnalitePayload,
    examples: { planDAction: { value: { id: 'PLAN_D_ACTION' } } }
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Créée ou déjà présente'
  })
  @Post('fonctionnalites')
  @HttpCode(HttpStatus.NO_CONTENT)
  async creerFonctionnalite(
    @Body() payload: CreerFonctionnalitePayload
  ): Promise<void> {
    const result = await this.creerFonctionnaliteCommandHandler.execute(
      { id: payload.id },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Fonctionnalités')
  @ApiOperation({
    summary: 'Supprime une fonctionnalité du référentiel',
    description:
      'Refusée tant qu’un déploiement la vise : supprimer d’abord le déploiement (DELETE /support/deploiements/:id).'
  })
  @ApiParam({ name: 'idFonctionnalite', example: 'PLAN_D_ACTION' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Supprimée' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Un déploiement la vise encore'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La fonctionnalité n’existe pas'
  })
  @Delete('fonctionnalites/:idFonctionnalite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerFonctionnalite(
    @Param('idFonctionnalite') idFonctionnalite: string
  ): Promise<void> {
    const result = await this.supprimerFonctionnaliteCommandHandler.execute(
      { id: idFonctionnalite },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Liste les populations avec leurs cibles et leurs déploiements',
    description:
      'Point de départ pour savoir quel `idPopulation` utiliser. Chaque population donne ses emails de conseillers, ses profils structure × dispositif et ses déploiements (nature, fonctionnalité, date d’activation).'
  })
  @ApiOkResponse({ type: PopulationSupportQueryModel, isArray: true })
  @Get('populations')
  async getPopulations(): Promise<PopulationSupportQueryModel[]> {
    const result = await this.getPopulationsSupportQueryHandler.execute(
      {},
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Crée une population, ou met à jour sa description',
    description: `Une population est un groupe cible nommé. On la remplit ensuite avec des emails de conseillers (POST /support/populations/conseillers) et/ou des profils structure × dispositif (POST /support/populations/profils).

**Qui en fait partie, résolu à la lecture :**
- un conseiller, s’il est cité par email ou si son propre profil correspond ;
- un jeune, si son propre profil correspond ou si son conseiller de référence (l’initial en cas de transfert temporaire) est cité par email.

Rejouer avec un id existant met à jour la description sans toucher aux cibles.`
  })
  @ApiBody({
    type: CreerPopulationPayload,
    examples: {
      pilote: {
        summary: 'Pilote par emails',
        value: { id: 'PILOTE_1J1S', description: 'Beta testeurs 1J1S' }
      },
      structure: {
        summary: 'Toute une structure, à compléter par un profil',
        value: {
          id: 'FT_TOUS',
          description: 'Tous les conseillers France Travail'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Créée ou mise à jour'
  })
  @Post('populations')
  @HttpCode(HttpStatus.NO_CONTENT)
  async creerPopulation(
    @Body() payload: CreerPopulationPayload
  ): Promise<void> {
    const result = await this.creerPopulationCommandHandler.execute(
      { id: payload.id, description: payload.description },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Lit une population avec ses cibles et ses déploiements',
    description:
      'Emails de conseillers, profils structure × dispositif et déploiements de la population. Utile pour vérifier une cible avant de la déployer.'
  })
  @ApiParam({ name: 'idPopulation', example: 'PILOTE_1J1S' })
  @ApiOkResponse({ type: PopulationSupportQueryModel })
  @ApiResponse(REPONSE_404_POPULATION)
  @Get('populations/:idPopulation')
  async getPopulation(
    @Param('idPopulation') idPopulation: string
  ): Promise<PopulationSupportQueryModel> {
    const result = await this.getPopulationSupportQueryHandler.execute(
      { idPopulation },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Ajoute des conseillers à une population, par email',
    description:
      'Les emails déjà présents sont ignorés. Un conseiller cité entraîne ses jeunes de référence dans la population.'
  })
  @ApiBody({
    type: ConseillersPopulationPayload,
    examples: {
      pilote: {
        value: {
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['a.dupont@francetravail.fr', 'b.martin@milo.fr']
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Ajoutés' })
  @ApiResponse(REPONSE_404_POPULATION)
  @Post('populations/conseillers')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ajouterConseillersPopulation(
    @Body() payload: ConseillersPopulationPayload
  ): Promise<void> {
    const result =
      await this.ajouterConseillersPopulationCommandHandler.execute(
        {
          idPopulation: payload.idPopulation,
          emailConseillers: payload.emailConseillers
        },
        Authentification.unUtilisateurSupport()
      )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Retire des conseillers d’une population',
    description:
      'Soit une liste d’emails, soit `supprimerTous: true` pour vider la cible par email (les profils restent).'
  })
  @ApiBody({
    type: SupprimerConseillersPopulationPayload,
    examples: {
      quelquesUns: {
        summary: 'Retirer des emails',
        value: {
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['a.dupont@francetravail.fr']
        }
      },
      tous: {
        summary: 'Vider la liste',
        value: { idPopulation: 'PILOTE_1J1S', supprimerTous: true }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Retirés' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Ni liste d’emails ni supprimerTous'
  })
  @ApiResponse(REPONSE_404_POPULATION)
  @Delete('populations/conseillers')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerConseillersPopulation(
    @Body() payload: SupprimerConseillersPopulationPayload
  ): Promise<void> {
    const result =
      await this.supprimerConseillersPopulationCommandHandler.execute(
        {
          idPopulation: payload.idPopulation,
          emailConseillers: payload.emailConseillers,
          supprimerTous: payload.supprimerTous
        },
        Authentification.unUtilisateurSupport()
      )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Ajoute un profil structure × dispositif à une population',
    description: `Sans dispositif, le profil couvre toute la structure. Le profil se lit sur chaque utilisateur : un jeune FT / CEJ est ciblé par \`(FRANCE_TRAVAIL, CEJ)\` quel que soit son conseiller.

Un conseiller MiLo n’a pas de dispositif : \`(MILO, PACEA)\` vise les jeunes PACEA mais aucun conseiller MiLo, viser \`(MILO)\` pour les toucher. Doublon ignoré.`
  })
  @ApiBody({
    type: ProfilPopulationPayload,
    examples: {
      ftCej: {
        summary: 'Un dispositif d’une structure',
        value: {
          idPopulation: 'FT_CEJ',
          structure: 'FRANCE_TRAVAIL',
          dispositif: 'CEJ'
        }
      },
      ftTous: {
        summary: 'Toute une structure',
        value: { idPopulation: 'FT_TOUS', structure: 'FRANCE_TRAVAIL' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Ajouté ou déjà présent'
  })
  @ApiResponse(REPONSE_404_POPULATION)
  @Post('populations/profils')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ajouterProfilPopulation(
    @Body() payload: ProfilPopulationPayload
  ): Promise<void> {
    const result = await this.ajouterProfilPopulationCommandHandler.execute(
      {
        idPopulation: payload.idPopulation,
        structure: payload.structure,
        dispositif: payload.dispositif
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Retire un profil d’une population',
    description:
      'Le profil doit correspondre exactement à celui ajouté : même structure, même dispositif (ou absence de dispositif).'
  })
  @ApiBody({
    type: ProfilPopulationPayload,
    examples: {
      ftCej: {
        value: {
          idPopulation: 'FT_CEJ',
          structure: 'FRANCE_TRAVAIL',
          dispositif: 'CEJ'
        }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Retiré' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Aucun profil ne correspond dans cette population'
  })
  @Delete('populations/profils')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerProfilPopulation(
    @Body() payload: ProfilPopulationPayload
  ): Promise<void> {
    const result = await this.supprimerProfilPopulationCommandHandler.execute(
      {
        idPopulation: payload.idPopulation,
        structure: payload.structure,
        dispositif: payload.dispositif
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Populations')
  @ApiOperation({
    summary: 'Supprime une population',
    description:
      'Ses emails, ses profils et ses communications partent avec elle. Refusée tant qu’un déploiement la vise : le supprimer d’abord.'
  })
  @ApiParam({ name: 'idPopulation', example: 'PILOTE_1J1S' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Supprimée' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Un déploiement la vise encore'
  })
  @ApiResponse(REPONSE_404_POPULATION)
  @Delete('populations/:idPopulation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerPopulation(
    @Param('idPopulation') idPopulation: string
  ): Promise<void> {
    const result = await this.supprimerPopulationCommandHandler.execute(
      { id: idPopulation },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Déploiements')
  @ApiOperation({
    summary: 'Crée un déploiement : une population, une nature, une date',
    description: `À partir de \`dateActivation\` (UTC) :
- \`nature\` FONCTIONNALITE : \`idFonctionnalite\` requis, le drapeau apparaît dans GET /jeunes/:id/fonctionnalites pour les jeunes de la population ;
- \`nature\` MIGRATION : pas de fonctionnalité, la connexion est refusée (422 MIGRATION_PARCOURS_EMPLOI) aux jeunes et conseillers de la population, et \`dateDeMigration\` leur est renvoyée. Une seule migration par population.

Renvoie l’id du déploiement, à garder pour modifier sa date (PUT /support/deploiements/:id) ou le supprimer. Rejouer sur la même population et la même fonctionnalité déplace la date au lieu de créer un doublon.`
  })
  @ApiBody({
    type: CreerDeploiementPayload,
    examples: {
      fonctionnalite: {
        summary: 'Activer une fonctionnalité pour une population',
        value: {
          nature: 'FONCTIONNALITE',
          idPopulation: 'PILOTE_1J1S',
          idFonctionnalite: 'PLAN_D_ACTION',
          dateActivation: '2026-10-13T00:00:00.000Z'
        }
      },
      migration: {
        summary: 'Programmer une migration',
        value: {
          nature: 'MIGRATION',
          idPopulation: 'PHASE_C',
          dateActivation: '2027-03-01T00:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Créé ou date déplacée, renvoie { id }'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'FONCTIONNALITE sans idFonctionnalite, MIGRATION avec idFonctionnalite, ou date invalide'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La population ou la fonctionnalité n’existe pas'
  })
  @Post('deploiements')
  @HttpCode(HttpStatus.CREATED)
  async creerDeploiement(
    @Body() payload: CreerDeploiementPayload
  ): Promise<DeploiementCree> {
    const result = await this.creerDeploiementCommandHandler.execute(
      {
        nature: payload.nature,
        idPopulation: payload.idPopulation,
        idFonctionnalite: payload.idFonctionnalite,
        dateActivation: DateTime.fromISO(payload.dateActivation)
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Déploiements')
  @ApiOperation({
    summary: 'Modifie la date d’activation d’un déploiement',
    description:
      'L’id est celui renvoyé par POST /support/deploiements, ou lu dans GET /support/populations/:idPopulation. Seule la date change : pour une autre population, nature ou fonctionnalité, supprimer et recréer.'
  })
  @ApiParam({ name: 'idDeploiement', example: 12 })
  @ApiBody({
    type: ModifierDateDeploiementPayload,
    examples: {
      report: { value: { dateActivation: '2026-11-02T00:00:00.000Z' } }
    }
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Date modifiée' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Le déploiement n’existe pas'
  })
  @Put('deploiements/:idDeploiement')
  @HttpCode(HttpStatus.NO_CONTENT)
  async modifierDateDeploiement(
    @Param('idDeploiement', ParseIntPipe) idDeploiement: number,
    @Body() payload: ModifierDateDeploiementPayload
  ): Promise<void> {
    const result = await this.modifierDateDeploiementCommandHandler.execute(
      {
        id: idDeploiement,
        dateActivation: DateTime.fromISO(payload.dateActivation)
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiOperation({
    summary: 'Supprime un déploiement',
    description:
      'L’id est celui renvoyé par POST /support/deploiements, ou lu dans GET /support/populations/:idPopulation. Le drapeau disparaît, ou la migration cesse de bloquer, immédiatement.'
  })
  @ApiParam({ name: 'idDeploiement', example: 12 })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Supprimé' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Le déploiement n’existe pas'
  })
  @Delete('deploiements/:idDeploiement')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerDeploiement(
    @Param('idDeploiement', ParseIntPipe) idDeploiement: number
  ): Promise<void> {
    const result = await this.supprimerDeploiementCommandHandler.execute(
      { id: idDeploiement },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: 'Crée une communication pour une population',
    description: `Message visible de \`dateDebut\` (incluse) à \`dateFin\` (exclue), en UTC, par les utilisateurs de la population. Aujourd'hui seul le couple destinataire CONSEILLER × type IN_APP est lu, via GET /conseillers/:id/communications.

Plusieurs communications peuvent viser la même population ; un utilisateur ne voit que celle dont la fin est la plus proche. Renvoie l'id, à garder pour la modifier (PATCH /support/communications/:id) ou la supprimer.`
  })
  @ApiBody({
    type: CreerCommunicationPayload,
    examples: {
      migration: {
        summary: 'Prévenir les conseillers d’une migration',
        value: {
          idPopulation: 'PHASE_C',
          destinataire: 'CONSEILLER',
          type: 'IN_APP',
          dateDebut: '2026-09-30T00:00:00.000Z',
          dateFin: '2026-10-15T00:00:00.000Z',
          titre: 'Votre application évolue',
          contenu:
            'Le 15 octobre 2026, l’application pass emploi ne sera plus disponible. Vos services seront accessibles sur l’application Parcours Emploi.\nNous vous recommandons de ne plus ajouter de nouveaux bénéficiaires à votre portefeuille.'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Créée, renvoie { id }'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Payload invalide, ou dateFin qui ne suit pas dateDebut'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La population n’existe pas'
  })
  @Post('communications')
  @HttpCode(HttpStatus.CREATED)
  async creerCommunication(
    @Body() payload: CreerCommunicationPayload
  ): Promise<CommunicationCreee> {
    const result = await this.creerCommunicationCommandHandler.execute(
      {
        idPopulation: payload.idPopulation,
        destinataire: payload.destinataire,
        type: payload.type,
        dateDebut: DateTime.fromISO(payload.dateDebut),
        dateFin: DateTime.fromISO(payload.dateFin),
        titre: payload.titre,
        contenu: payload.contenu,
        ctaLabel: payload.ctaLabel,
        ctaUrlAndroid: payload.ctaUrlAndroid,
        ctaUrlIos: payload.ctaUrlIos
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: 'Modifie une communication',
    description: `Seuls les champs envoyés changent, les autres sont conservés (mêmes règles que la création). L’id est celui renvoyé par POST /support/communications, ou lu dans GET /support/populations/:idPopulation.

Pratique : copier une communication depuis GET /support/populations/:idPopulation, corriger ce qu'il faut et renvoyer l'objet tel quel — le champ \`id\` est ignoré.`
  })
  @ApiParam({ name: 'idCommunication', example: 3 })
  @ApiBody({
    type: ModifierCommunicationPayload,
    examples: {
      unePhrase: {
        summary: 'Corriger le contenu',
        value: {
          contenu:
            'Le 15 octobre 2026, l’application pass emploi ne sera plus disponible.\nVos services seront accessibles sur l’application Parcours Emploi.'
        }
      },
      prolonger: {
        summary: 'Prolonger la visibilité',
        value: { dateFin: '2026-10-31T00:00:00.000Z' }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Modifiée' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Payload invalide, ou dateFin qui ne suit pas dateDebut'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La communication ou la population n’existe pas'
  })
  @Patch('communications/:idCommunication')
  @HttpCode(HttpStatus.NO_CONTENT)
  async modifierCommunication(
    @Param('idCommunication', ParseIntPipe) idCommunication: number,
    @Body() payload: ModifierCommunicationPayload
  ): Promise<void> {
    const result = await this.modifierCommunicationCommandHandler.execute(
      {
        id: idCommunication,
        idPopulation: payload.idPopulation,
        destinataire: payload.destinataire,
        type: payload.type,
        dateDebut: payload.dateDebut
          ? DateTime.fromISO(payload.dateDebut)
          : undefined,
        dateFin: payload.dateFin
          ? DateTime.fromISO(payload.dateFin)
          : undefined,
        titre: payload.titre,
        contenu: payload.contenu,
        ctaLabel: payload.ctaLabel,
        ctaUrlAndroid: payload.ctaUrlAndroid,
        ctaUrlIos: payload.ctaUrlIos
      },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @ReserveAuSupport
  @ApiTags('Support - Communications')
  @ApiOperation({
    summary: 'Supprime une communication',
    description:
      'L’id est celui renvoyé par POST /support/communications, ou lu dans GET /support/populations/:idPopulation. Le message disparaît immédiatement.'
  })
  @ApiParam({ name: 'idCommunication', example: 3 })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Supprimée' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La communication n’existe pas'
  })
  @Delete('communications/:idCommunication')
  @HttpCode(HttpStatus.NO_CONTENT)
  async supprimerCommunication(
    @Param('idCommunication', ParseIntPipe) idCommunication: number
  ): Promise<void> {
    const result = await this.supprimerCommunicationCommandHandler.execute(
      { id: idCommunication },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  SetMetadata,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags
} from '@nestjs/swagger'
import Bull from 'bull'
import { ArchiverJeunesMigrationCommandHandler } from '../../application/commands/archiver-jeunes-migrations.command.handler'
import { RebasculerJeunesOrphelinsMigrationCommandHandler } from '../../application/commands/rebasculer-jeunes-orphelins-migration.command.handler'
import { NotifierBeneficiairesCommandHandler } from '../../application/commands/notifier-beneficiaires.command.handler'
import { ArchiverJeuneSupportCommandHandler } from '../../application/commands/support/archiver-jeune-support.command.handler'
import {
  CreerJeunePESupportCommand,
  CreerJeunePESupportCommandHandler
} from '../../application/commands/support/creer-jeune-pe-support-command-handler.service'
import {
  DesarchivageJeuneQueryModel,
  DesarchiverJeuneCommandHandler
} from '../../application/commands/support/desarchiver-jeune.command.handler.db'
import { SupprimerArchiveJeuneCommandHandler } from '../../application/commands/support/supprimer-archive-jeune.command.handler'
import { CreerSuperviseursCommandHandler } from '../../application/commands/support/creer-superviseurs.command.handler'
import { DeleteSuperviseursCommandHandler } from '../../application/commands/support/delete-superviseurs.command.handler'
import { FusionnerAgencesCommandHandler } from '../../application/commands/support/fusionner-agences.command.handler'
import {
  MettreAJourLesJeunesCejPeCommandHandler,
  MettreAJourLesJeunesCEJPoleEmploiCommand
} from '../../application/commands/support/mettre-a-jour-les-jeunes-cej-pe.command.handler'
import {
  RefreshJddCommand,
  RefreshJddCommandHandler
} from '../../application/commands/support/refresh-jdd.command.handler'
import { ModifierAgenceFTConseillerCommandHandler } from '../../application/commands/support/modifier-agence-ft-conseiller.command.handler.db'
import { UpdateAgenceConseillerCommandHandler } from '../../application/commands/support/update-agence-conseiller.command.handler'
import { UpdateFeatureFlipCommandHandler } from '../../application/commands/support/update-feature-flip.command.handler.db'
import { TransfererJeunesConseillerCommandHandler } from '../../application/commands/transferer-jeunes-conseiller.command.handler'
import { failure, Result, success } from '../../building-blocks/types/result'
import { ChangementAgenceQueryModel } from '../../domain/agence'
import { Authentification } from '../../domain/authentification'
import { Core } from '../../domain/core'
import { Notification } from '../../domain/notification/notification'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../domain/planificateur'
import { ApiKeyAuthGuard } from '../auth/api-key.auth-guard'
import { OidcClient } from '../clients/oidc-client.db'
import { SkipOidcAuth } from '../decorators/skip-oidc-auth.decorator'
import { handleResult } from './result.handler'
import {
  ChangerAgenceConseillerPayload,
  CreerJeuneSupportPayload,
  DesarchiverJeunePayload,
  FusionnerAgencesPayload,
  ListerJobsQueryParams,
  ModifierAgenceFTConseillerPayload,
  NotifierBeneficiairesPayload,
  RefreshJDDPayload,
  SuperviseursPayload,
  TeleverserCsvPayload,
  TransfererJeunesPayload,
  UpdateFeatureFlipPayload
} from './validation/support.inputs'
import { Migration } from '../../domain/migration'
import PhaseDeMigration = Migration.PhaseDeMigration
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { JeuneQueryModel } from '../../application/queries/query-models/jeunes.query-model'

export class JobSummaryQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  type: string

  @ApiProperty()
  statut: string

  @ApiProperty()
  timestamp: number

  @ApiPropertyOptional()
  processedOn?: number

  @ApiPropertyOptional()
  finishedOn?: number

  @ApiProperty()
  attemptsMade: number

  @ApiPropertyOptional()
  failedReason?: string
}

function toJobSummaryQueryModel(
  job: Bull.Job,
  statut: string
): JobSummaryQueryModel {
  return {
    id: String(job.id),
    type: job.data?.type,
    statut,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? undefined,
    finishedOn: job.finishedOn ?? undefined,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason ?? undefined
  }
}

@Controller('support')
@ApiTags('Support')
@SkipOidcAuth()
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('api_key')
export class SupportController {
  constructor(
    private readonly refreshJddCommandHandler: RefreshJddCommandHandler,
    private readonly mettreAJourLesJeunesCejPeCommandHandler: MettreAJourLesJeunesCejPeCommandHandler,
    private readonly updateAgenceCommandHandler: UpdateAgenceConseillerCommandHandler,
    private readonly modifierAgenceFTConseillerCommandHandler: ModifierAgenceFTConseillerCommandHandler,
    private readonly fusionnerAgencesCommandHandler: FusionnerAgencesCommandHandler,
    private readonly archiverJeuneSupportCommandHandler: ArchiverJeuneSupportCommandHandler,
    private readonly desarchiverJeuneCommandHandler: DesarchiverJeuneCommandHandler,
    private readonly creerJeuneSupportCommandHandler: CreerJeunePESupportCommandHandler,
    private readonly supprimerArchiveJeuneCommandHandler: SupprimerArchiveJeuneCommandHandler,
    private readonly transfererJeunesConseillerCommandHandler: TransfererJeunesConseillerCommandHandler,
    private readonly creerSuperviseursCommandHandler: CreerSuperviseursCommandHandler,
    private readonly deleteSuperviseursCommandHandler: DeleteSuperviseursCommandHandler,
    private readonly updateFeatureFlipCommandHandler: UpdateFeatureFlipCommandHandler,
    private readonly notifierBeneficiairesCommandHandler: NotifierBeneficiairesCommandHandler,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly archiverJeunesMigrationCommandHandler: ArchiverJeunesMigrationCommandHandler,
    private readonly rebasculerJeunesOrphelinsMigrationCommandHandler: RebasculerJeunesOrphelinsMigrationCommandHandler,
    private readonly oidcClient: OidcClient
  ) {}

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: 'Crée un jeune Pôle emploi pour un conseiller via le support',
    description:
      'Autorisé uniquement pour le support. Utilisé pour dépannage lorsque le conseiller Pôle emploi est indisponible. Le jeune Pôle emploi est rattaché au conseiller fourni dans le payload. Le motif est optionnel et sert uniquement pour les logs.'
  })
  @Post('jeunes')
  @ApiResponse({
    type: JeuneQueryModel
  })
  async creerJeunePourConseiller(
    @Body() payload: CreerJeuneSupportPayload
  ): Promise<JeuneQueryModel> {
    const command: CreerJeunePESupportCommand = {
      idConseiller: payload.idConseiller,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      motif: payload.motif
    }
    const result = await this.creerJeuneSupportCommandHandler.execute(
      command,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result, jeune => ({
      id: jeune.id,
      firstName: jeune.firstName,
      lastName: jeune.lastName,
      idConseiller: jeune.conseiller!.id
    }))
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @Post('jdd')
  async refresh(@Body() payload: RefreshJDDPayload): Promise<void> {
    const command: RefreshJddCommand = {
      idConseiller: payload.idConseiller,
      menage: payload.menage
    }
    const result = await this.refreshJddCommandHandler.execute(
      command,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @Post('cej/pole-emploi')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('fichier'))
  async postFichierCEJ(
    @Body() _payload: TeleverserCsvPayload,
    @UploadedFile() fichier: Express.Multer.File
  ): Promise<void> {
    const command: MettreAJourLesJeunesCEJPoleEmploiCommand = {
      fichier: fichier
    }
    const result = await this.mettreAJourLesJeunesCejPeCommandHandler.execute(
      command,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Attribue une nouvelle agence au conseiller identifié par son ID (ID en base, et pas ID Authentification)',
    description: 'Autorisé pour le support'
  })
  @Post('changer-agence-conseiller-milo')
  async changerAgenceConseiller(
    @Body() payload: ChangerAgenceConseillerPayload
  ): Promise<ChangementAgenceQueryModel> {
    const command: ChangerAgenceConseillerPayload = {
      idConseiller: payload.idConseiller,
      idNouvelleAgence: payload.idNouvelleAgence
    }
    const result = await this.updateAgenceCommandHandler.execute(
      command,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      "Modifie l'agence d'un conseiller France Travail (ID en base, et pas ID Authentification)",
    description:
      "Autorisé uniquement pour le support. Rattache le conseiller à l'agence cible du référentiel France Travail et efface son éventuelle agence saisie manuellement.\n\n" +
      "À la différence de POST /support/changer-agence-conseiller-milo, aucune animation collective n'est transférée (les animations collectives sont un usage MILO) et le conseiller n'a pas besoin d'avoir déjà une agence."
  })
  @Post('changer-agence-conseiller-ft')
  @HttpCode(HttpStatus.NO_CONTENT)
  async modifierAgenceFTConseiller(
    @Body() payload: ModifierAgenceFTConseillerPayload
  ): Promise<void> {
    const result = await this.modifierAgenceFTConseillerCommandHandler.execute(
      {
        idConseiller: payload.idConseiller,
        idAgence: payload.idAgence
      },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Attribue une nouvelle agence au conseiller identifié par son ID (ID en base, et pas ID Authentification)',
    description: 'Autorisé pour le support'
  })
  @Post('fusionner-agences')
  @ApiResponse({
    type: ChangementAgenceQueryModel,
    isArray: true
  })
  async fusionnerAgences(
    @Body() payload: FusionnerAgencesPayload
  ): Promise<ChangementAgenceQueryModel[]> {
    const command: FusionnerAgencesPayload = {
      idAgenceSource: payload.idAgenceSource,
      idAgenceCible: payload.idAgenceCible
    }
    const result = await this.fusionnerAgencesCommandHandler.execute(
      command,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Archive le jeune identifié par son ID (ID en base, et pas ID Authentification)',
    description:
      ' l’API support pour archiver le jeune\n' +
      '- Suppression de la BDD de son compte utilisateur\n' +
      '- Suppression de l’authentification Keycloak\n' +
      '- Suppression du chat firebase\n' +
      '- Envoi d’un email au jeune\n'
  })
  @Post('archiver-jeune/:idJeune')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiverJeune(@Param('idJeune') idJeune: string): Promise<void> {
    const result = await this.archiverJeuneSupportCommandHandler.execute(
      {
        idJeune
      },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Désarchive un jeune archivé par erreur, via l’identifiant en base de son archive',
    description:
      'Autorisé uniquement pour le support. Restaure un maximum de données depuis l’archive :\n' +
      '- Recréation du jeune (identité, email, structure, dispositif, dates), rattaché au conseiller fourni dans le payload\n' +
      '- Restauration des actions (et commentaires), des rendez-vous individuels, des favoris et des recherches sauvegardées\n' +
      '- Réinitialisation du chat Firebase avec réinjection des messages archivés (texte et historique d’édition)\n\n' +
      'Mode fusion (payload `idJeuneRecree`) : quand le jeune s’est déjà recréé un compte, le jeune archivé n’est pas recréé et les données sont rattachées à ce compte, qui garde son identité, son authentification et son conseiller (`idConseiller` devient alors inutile). Les actions et rendez-vous déjà re-saisis sur ce compte ne sont pas dupliqués (voir `actionsIgnoreesDoublon` / `rendezVousIgnoresDoublon`), et les favoris/recherches déjà présents sont ignorés.\n\n' +
      'Limites (données définitivement perdues) :\n' +
      '- Les pièces jointes, offres liées aux messages et statuts de lecture ne sont pas restaurés (contenu texte uniquement)\n' +
      '- Les inscriptions aux animations collectives ne sont pas restaurées\n' +
      '- Les préférences, tokens de notification et l’historique de transferts sont réinitialisés\n' +
      '- Le compte de l’IDP ayant été supprimé, le jeune sera réassocié par email à sa prochaine connexion\n\n' +
      'L’archive existante n’est pas supprimée, si vous voulez la supprimer, utiliser DELETE /support/archives-jeune/:idArchive une fois la restauration vérifiée.'
  })
  @Post('desarchiver-jeune/:idArchive')
  @ApiResponse({ type: DesarchivageJeuneQueryModel })
  async desarchiverJeune(
    @Param('idArchive', ParseIntPipe) idArchive: number,
    @Body() payload: DesarchiverJeunePayload
  ): Promise<DesarchivageJeuneQueryModel> {
    const result = await this.desarchiverJeuneCommandHandler.execute(
      {
        idArchive,
        idConseiller: payload.idConseiller,
        idJeuneRecree: payload.idJeuneRecree
      },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: 'Transférer les jeunes renseignés d’un conseiller à un autre',
    description: 'Autorisé pour le support'
  })
  @Post('transferer-jeunes')
  @HttpCode(HttpStatus.NO_CONTENT)
  async transfererJeunesSupport(
    @Body() payload: TransfererJeunesPayload
  ): Promise<void> {
    const result = await this.transfererJeunesConseillerCommandHandler.execute(
      {
        idConseillerSource: payload.idConseillerSource,
        idConseillerCible: payload.idConseillerCible,
        idsJeunes: payload.idsJeunes,
        estTemporaire: false,
        provenanceUtilisateur: Authentification.Type.SUPPORT
      },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: 'Ajoute des droits de supervision à des conseillers',
    description: 'Autorisé pour le support'
  })
  @Post('superviseurs')
  async postSuperviseurs(
    @Body() superviseursPayload: SuperviseursPayload
  ): Promise<void> {
    const result = await this.creerSuperviseursCommandHandler.execute(
      {
        emails: superviseursPayload.emails
      },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: 'Supprime des droits de supervision à des conseillers',
    description: 'Autorisé pour le support'
  })
  @Delete('superviseurs')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSuperviseurs(
    @Body() superviseursPayload: SuperviseursPayload
  ): Promise<void> {
    const result = await this.deleteSuperviseursCommandHandler.execute(
      { emails: superviseursPayload.emails },
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Enregistre la liste des conseillers (via leur email) qui accèdent à une fonctionnalité (les jeunes associés seront calculés automatiquement à la volée)',
    description: 'Autorisé pour le support'
  })
  @Post('feature-flip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateFeatureFlip(
    @Body() payload: UpdateFeatureFlipPayload
  ): Promise<void> {
    const result = await this.updateFeatureFlipCommandHandler.execute(
      payload,
      Authentification.unUtilisateurSupport()
    )

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Notifie un groupe de bénéficiaires appartenants à une ou plusieures structures.',
    description: `
Notifie un groupe de bénéficiaires appartenant à une ou plusieurs structures
(crée un job de type NOTIFIER_BENEFICIAIRES).

**Champs du body :**
- \`typeNotification\` (optionnel) : détermine la page et le point d'ancrage vers lequel l'utilisateur sera redirigé en cliquant sur la notification.
<br>Valeurs possibles : ${Object.values(Notification.TypeNotifManuelle).join(
      ', '
    )}
- \`titre\` : titre de la notification - maximum 50 caractères
- \`description\` : texte corps de la notification - maximum 150 caractères
- \`structures\` (optionnel, défaut = toutes les structures) : ${Object.values(
      Core.Structure
    ).join(', ')}
- \`PhaseDeMigration\` (optionnel) : tag de feature flip pour cibler les bénéficiaires d'une phase de migration Parcours Emploi. Valeurs possibles : ${Object.values(
      Migration.PhaseDeMigration
    ).join(', ')}
- \`push\` (optionnel, défaut = true) : notifie les bénéficiaires en mode push (via Firebase) pour apparaître dans le centre de notifications de l'appareil
- \`batchSize\` (optionnel, défaut = 1/4 de la population totale) : taille d’un batch
- \`minutesEntreLesBatch\` (optionnel, défaut = 5) : minutes entre chaque batch
`
  })
  @ApiBody({
    schema: {
      example: {
        typeNotification: 'OUTILS',
        titre: '1000 immersions sur la vente et la logistique !',
        description: 'Explorez les métiers de vente et de la logistique',
        structures: ['MILO', 'POLE_EMPLOI_AIJ'],
        PhaseDeMigration: 'PHASE_A',
        push: true
      }
    }
  })
  @Post('notifier-beneficiaires')
  @HttpCode(HttpStatus.CREATED)
  async notifierBeneficiaires(
    @Body() payload: NotifierBeneficiairesPayload
  ): Promise<Planificateur.JobId> {
    const createdJobId =
      await this.notifierBeneficiairesCommandHandler.execute(payload)
    return handleResult(createdJobId)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: "Récupère les informations d'un job via son id."
  })
  @Get('job-information/:jobId')
  @HttpCode(HttpStatus.OK)
  async getJobInformation(@Param('jobId') jobId: string): Promise<Bull.Job> {
    let result: Result<Bull.Job>
    try {
      const job = await this.planificateurRepository.getJobInformations({
        jobId: jobId
      })
      result = success(job)
    } catch (e) {
      result = failure(e)
    }
    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Compteurs de jobs Bull : totaux exacts par statut + ventilation par type sur les statuts vivants',
    description: `
Équivalent de la commande "stats" de Bull, en deux parties.

**1. \`parStatut\` — totaux EXACTS par statut**
Obtenus via \`Queue.getJobCounts()\`, qui fait un simple comptage Redis (ZCARD/LLEN) par statut.
Opération O(1), instantanée, sûre quelle que soit la taille des sets. Statuts : \`waiting\`, \`active\`, \`delayed\`, \`completed\`, \`failed\`, \`paused\`.

**2. \`parTypeStatutsVivants\` — ventilation par JobType, ÉCHANTILLONNÉE et BORNÉE**
Le JobType (NOTIFIER_BENEFICIAIRES, etc.) n'est pas indexé par Bull : il vit dans \`job.data.type\`.
Compter par type impose donc de charger les jobs et de les grouper côté Node. Pour rester non bloquant :
- la ventilation ne porte QUE sur les statuts dits "vivants" : \`waiting\`, \`active\`, \`delayed\`, \`failed\` ;
- le statut \`completed\` est VOLONTAIREMENT EXCLU : ce set peut contenir des centaines de milliers de jobs, le scanner saturerait Redis (cause d'incidents passés) et n'a aucun intérêt (simple historique) ;
- chaque statut n'est échantillonné que sur ses **50 jobs les plus récents** (limite \`MAX_NUMBER_REDIS_JOBS\`).

**⚠️ Conséquence à connaître :** \`parStatut\` est exact, mais \`parTypeStatutsVivants\` est un ÉCHANTILLON.
En particulier le set \`delayed\` peut être volumineux (crons à venir + rappels planifiés) : la ventilation par type sur \`delayed\` ne reflète alors que les 50 jobs les plus récents, pas l'intégralité du set. Ne pas l'utiliser comme un comptage exact par type.

**Workflow de diagnostic conseillé :**
\`GET /support/jobs/stats\` (vue d'ensemble) → \`GET /support/jobs?statut=failed\` (liste + ids) → \`GET /support/job-information/:jobId\` (détail d'un job).`
  })
  @Get('jobs/stats')
  @HttpCode(HttpStatus.OK)
  async getJobsStats(): Promise<Planificateur.StatsJobs> {
    let result: Result<Planificateur.StatsJobs>
    try {
      const stats = await this.planificateurRepository.compterLesJobs()
      result = success(stats)
    } catch (e) {
      result = failure(e)
    }
    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Liste paginée et légère des jobs d’un statut (ids + aperçu), pour récupérer leurs ids puis le détail via job-information/:jobId',
    description: `
Renvoie une fenêtre paginée de jobs pour un statut donné, sous forme d'un résumé léger (pas l'objet Bull complet).

**Paramètres de requête :**
- \`statut\` (requis) : \`waiting\` | \`active\` | \`delayed\` | \`completed\` | \`failed\` | \`paused\`.
- \`jobType\` (optionnel) : filtre par type de job (ex. NOTIFIER_BENEFICIAIRES).
- \`debut\` (optionnel, défaut 0) et \`fin\` (optionnel, défaut 20) : bornes de la fenêtre de pagination.

**Comportement :**
- Les jobs sont renvoyés par récence (\`getJobs([statut], debut, fin)\`) : les ids les plus récents sortent en premier. La pagination borne le scan, donc l'endpoint reste sûr même sur un set volumineux comme \`completed\`.
- Le filtre \`jobType\` est appliqué APRÈS pagination (Bull n'indexe pas par type) : une page peut donc contenir moins de \`fin - debut\` éléments une fois filtrée. Pour parcourir plus loin, augmenter \`debut\`/\`fin\`.

**Champs du résumé (JobSummaryQueryModel) :** \`id\`, \`type\`, \`statut\`, \`timestamp\`, \`processedOn\`, \`finishedOn\`, \`attemptsMade\`, \`failedReason\`.
Utiliser l'\`id\` retourné avec \`GET /support/job-information/:jobId\` pour obtenir le détail complet du job.`
  })
  @ApiResponse({ type: JobSummaryQueryModel, isArray: true })
  @Get('jobs')
  @HttpCode(HttpStatus.OK)
  async listerJobs(
    @Query() query: ListerJobsQueryParams
  ): Promise<JobSummaryQueryModel[]> {
    let result: Result<JobSummaryQueryModel[]>
    try {
      const jobs = await this.planificateurRepository.listerJobs({
        statut: query.statut,
        jobType: query.jobType,
        debut: query.debut,
        fin: query.fin
      })
      result = success(
        jobs.map(job => toJobSummaryQueryModel(job, query.statut))
      )
    } catch (e) {
      result = failure(e)
    }
    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: "Archive les jeunes d'une phase de migration",
    description: `
L'API support pour archiver les jeunes d'une phase de migration
  - Suppression de la BDD de son compte utilisateur
  - Suppression de l'authentification Keycloak
  - Suppression du chat firebase
  - Envoi d'un email au jeune
  
PhaseDeMigration : ${Object.values(Migration.PhaseDeMigration).join(', ')}
 `
  })
  @Post('archiver-jeunes-migration/:phaseDeMigration')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiverJeuneRegion(
    @Param('phaseDeMigration', new ParseEnumPipe(Migration.PhaseDeMigration))
    phaseDeMigration: PhaseDeMigration
  ): Promise<void> {
    const result = await this.archiverJeunesMigrationCommandHandler.handle({
      phaseDeMigration
    })

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Rebasculer les jeunes orphelins vers leur conseiller initial après une migration',
    description: `
Identifie les jeunes en transfert temporaire dont le conseiller actuel migre pour la phase indiquée
mais dont le conseiller initial n'est pas concerné par cette migration, et les remet sous leur
conseiller initial (récupération définitive).

PhaseDeMigration : ${Object.values(Migration.PhaseDeMigration).join(', ')}
`
  })
  @Post('rebasculer-jeunes-orphelins-migration/:phaseDeMigration')
  @HttpCode(HttpStatus.NO_CONTENT)
  async rebasculerJeunesOrphelinsMigration(
    @Param('phaseDeMigration', new ParseEnumPipe(Migration.PhaseDeMigration))
    phaseDeMigration: PhaseDeMigration
  ): Promise<void> {
    const result =
      await this.rebasculerJeunesOrphelinsMigrationCommandHandler.handle({
        phaseDeMigration
      })

    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary: 'Supprime une archive jeune via son identifiant en base',
    description: 'Autorisé pour le support'
  })
  @Delete('archives-jeune/:idArchive')
  @HttpCode(HttpStatus.OK)
  async supprimerArchiveJeune(
    @Param('idArchive', ParseIntPipe) idArchive: number
  ): Promise<void> {
    const result = await this.supprimerArchiveJeuneCommandHandler.execute(
      { idArchive },
      Authentification.unUtilisateurSupport()
    )
    return handleResult(result)
  }

  @SetMetadata(
    Authentification.METADATA_IDENTIFIER_API_KEY_PARTENAIRE,
    Authentification.Partenaire.SUPPORT
  )
  @ApiOperation({
    summary:
      'Supprime les tokens partenaire du jeune pour forcer une déconnexion',
    description: 'Autorisé pour le support'
  })
  @Post('logout/:idJeune')
  async logoutJeune(@Param('idJeune') idJeune: string): Promise<void> {
    await this.oidcClient.deleteAccount(idJeune)
  }
}

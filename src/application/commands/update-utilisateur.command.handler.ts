import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  NonTraitableError,
  NonTraitableReason
} from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../domain/archive-jeune'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import { Core } from '../../domain/core'
import {
  DispositifNonAccompagne,
  Jeune,
  JeuneNonAccompagne,
  JeuneRepositoryToken
} from '../../domain/jeune/jeune'
import { Migration } from '../../domain/migration'
import { MailServiceToken } from '../../domain/mail'
import {
  estConseilDepartemental,
  estDispositifNonAccompagne,
  estFranceTravail,
  estMilo,
  memeProfil,
  Profil,
  structureLegacyVersProfil,
  TOUT_PROFIL
} from '../../domain/profil'
import { MailBrevoService } from '../../infrastructure/clients/mail-brevo.service.db'
import { DateService } from '../../utils/date-service'
import {
  queryModelFromUtilisateur,
  UtilisateurQueryModel
} from '../queries/query-models/authentification.query-model'
import Type = Authentification.Type
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport

// Format d'entrée de connect (rétro-compat) : structure legacy, ou
// 'FRANCE_TRAVAIL' pour le bouton unique FT Connect (dispositif inconnu).
export type StructureUtilisateurAuth = Core.Structure | 'FRANCE_TRAVAIL'
export type TypeUtilisateurAuth = Authentification.Type | 'BENEFICIAIRE'

export interface UpdateUtilisateurCommand extends Command {
  idUtilisateurAuth: string
  nom?: string
  prenom?: string
  email?: string
  username?: string
  type: TypeUtilisateurAuth
  structure: StructureUtilisateurAuth
  federatedToken?: string
  installationId?: string
}

@Injectable()
export class UpdateUtilisateurCommandHandler extends CommandHandler<
  UpdateUtilisateurCommand,
  UtilisateurQueryModel
> {
  readonly profilsAutorises = TOUT_PROFIL

  constructor(
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly authentificationFactory: Authentification.Factory,
    private readonly dateService: DateService,
    @Inject(MailServiceToken)
    private readonly mailBrevoService: MailBrevoService,
    private readonly migrationService: Migration.Service,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiverJeuneRepository: ArchiveJeune.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    private readonly jeuneNonAccompagneFactory: JeuneNonAccompagne.Factory
  ) {
    super('UpdateUtilisateurCommandHandler')
  }

  async handle(
    command: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const commandSanitized: UpdateUtilisateurCommand = {
      ...command,
      email: command.email?.toLocaleLowerCase()
    }

    let result: Result<UtilisateurQueryModel>

    switch (commandSanitized.type) {
      case Authentification.Type.CONSEILLER:
        result = await this.recupererConseiller(commandSanitized)
        break
      case Authentification.Type.JEUNE:
      case 'BENEFICIAIRE':
        result = await this.recupererBeneficiaire(commandSanitized)
        break
      case Authentification.Type.SUPPORT:
        return failure(
          new NonTraitableError(
            'Utilisateur',
            commandSanitized.idUtilisateurAuth,
            NonTraitableReason.TYPE_UTILISATEUR_NON_TRAITABLE
          )
        )
    }

    if (
      isSuccess(result) &&
      (await this.lUtilisateurDoitMigrerVersParcoursEmploi(result.data))
    ) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          NonTraitableReason.MIGRATION_PARCOURS_EMPLOI,
          result.data.email
        )
      )
    }
    if (
      isFailure(result) &&
      (await this.lUtilisateurEstArchive(commandSanitized.email))
    ) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          NonTraitableReason.MIGRATION_PARCOURS_EMPLOI,
          commandSanitized.email
        )
      )
    }

    if (
      isSuccess(result) &&
      commandSanitized.installationId &&
      result.data.type === Authentification.Type.JEUNE
    ) {
      try {
        await this.authentificationRepository.updateInstallationIdJeune(
          result.data.id,
          commandSanitized.installationId
        )
      } catch (e) {
        this.logger.error(e)
      }
    }

    return result
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }

  private recupererConseiller(
    commandSanitized: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    if (commandSanitized.structure === 'FRANCE_TRAVAIL') {
      return this.recupererUtilisateurConseillerExistant(commandSanitized)
    }

    const profil = profilAttendu(commandSanitized)
    const estConseillerTraitable =
      estMilo(profil.structure) ||
      estConseilDepartemental(profil.structure) ||
      (estFranceTravail(profil.structure) &&
        !estDispositifNonAccompagne(profil.dispositif))
    if (estConseillerTraitable) {
      return this.recupererOuCreerUtilisateurConseiller(
        commandSanitized,
        profil
      )
    }
    return Promise.resolve(
      failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          NonTraitableReason.STRUCTURE_UTILISATEUR_NON_TRAITABLE
        )
      )
    )
  }

  private async recupererBeneficiaire(
    commandSanitized: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const profil = profilAttendu(commandSanitized)
    if (estMilo(profil.structure)) {
      return this.authentificationJeuneMilo(commandSanitized)
    }
    if (estFranceTravail(profil.structure)) {
      if (estDispositifNonAccompagne(profil.dispositif)) {
        return this.authentificationBeneficiaireNonAccompagne(
          commandSanitized,
          profil
        )
      }
      if (profil.dispositif !== Profil.Dispositif.AVENIR_PRO) {
        return this.authentificationBeneficiaireFT(commandSanitized)
      }
    }
    return failure(
      new NonTraitableError(
        'Utilisateur',
        commandSanitized.idUtilisateurAuth,
        NonTraitableReason.STRUCTURE_UTILISATEUR_NON_TRAITABLE
      )
    )
  }

  private async authentifierJeuneParEmail(
    command: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    if (!command.email) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          command.idUtilisateurAuth,
          NonTraitableReason.EMAIL_BENEFICIAIRE_INTROUVABLE
        )
      )
    }

    const utilisateurInitialTrouve =
      await this.authentificationRepository.getJeuneByEmail(
        command.email.toLocaleLowerCase()
      )

    if (!utilisateurInitialTrouve) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          command.idUtilisateurAuth,
          NonTraitableReason.UTILISATEUR_INEXISTANT,
          command.email
        )
      )
    }
    const verificationUtilisateur = verifierProfilBeneficiaire(
      utilisateurInitialTrouve,
      command
    )
    if (isFailure(verificationUtilisateur)) {
      return verificationUtilisateur
    }

    const maintenant = this.dateService.nowJs()
    const utilisateurMisAJour: Authentification.Utilisateur = {
      ...utilisateurInitialTrouve,
      id: utilisateurInitialTrouve.id,
      prenom: command.prenom ?? utilisateurInitialTrouve.prenom,
      nom: command.nom ?? utilisateurInitialTrouve.nom,
      profil: utilisateurInitialTrouve.profil,
      type: Authentification.Type.JEUNE,
      roles: [],
      email: command.email ?? utilisateurInitialTrouve.email,
      dateDerniereConnexion: maintenant,
      datePremiereConnexion: maintenant,
      idAuthentification: command.idUtilisateurAuth
    }
    await this.authentificationRepository.update(utilisateurMisAJour)
    return success(queryModelFromUtilisateur(utilisateurMisAJour))
  }

  private async creerNouveauConseiller(
    command: UpdateUtilisateurCommand,
    profil: Profil
  ): Promise<Result<UtilisateurQueryModel>> {
    const estSuperviseur =
      await this.authentificationRepository.estConseillerSuperviseur(
        profil,
        command.email
      )

    const result = this.authentificationFactory.buildConseiller(
      command.idUtilisateurAuth,
      command.nom,
      command.prenom,
      command.email,
      command.username,
      profil,
      estSuperviseur
    )

    if (isFailure(result)) {
      return result
    }

    const utilisateurConseiller: Authentification.Utilisateur = {
      ...result.data,
      dateDerniereConnexion: this.dateService.nowJs()
    }
    await this.authentificationRepository.save(
      utilisateurConseiller,
      this.dateService.nowJs()
    )
    if (estMilo(utilisateurConseiller.profil.structure)) {
      await this.mailBrevoService.envoyerEmailCreationConseillerMilo(
        utilisateurConseiller
      )
    }
    return success(queryModelFromUtilisateur(utilisateurConseiller))
  }

  private async mettreAJourLUtilisateur(
    utilisateur: Authentification.Utilisateur,
    command: UpdateUtilisateurCommand
  ): Promise<Authentification.Utilisateur> {
    const maintenant = this.dateService.nowJs()
    const utilisateurMisAJour: Authentification.Utilisateur = {
      ...utilisateur,
      email: command.email ?? utilisateur.email,
      idAuthentification: command.idUtilisateurAuth,
      nom: command.nom ?? utilisateur.nom,
      prenom: command.prenom ?? utilisateur.prenom,
      dateDerniereConnexion: maintenant,
      datePremiereConnexion: utilisateur.datePremiereConnexion ?? maintenant,
      username: command.username ?? utilisateur.username
    }

    await this.authentificationRepository.update(utilisateurMisAJour)

    const estUnConseillerMilo =
      estMilo(utilisateur.profil.structure) &&
      Authentification.estConseiller(utilisateur.type)

    if (estUnConseillerMilo) {
      const quiVientDeRemplirSonEmail = !utilisateur.email && command.email
      const dontLaDateDePremiereConnexionEstInferieureA30Jours =
        utilisateur.datePremiereConnexion &&
        DateService.isGreater(
          DateService.fromJSDateToDateTime(utilisateur.datePremiereConnexion)!,
          this.dateService.now().minus({ days: 30 })
        )

      if (
        quiVientDeRemplirSonEmail &&
        dontLaDateDePremiereConnexionEstInferieureA30Jours
      ) {
        await this.mailBrevoService.envoyerEmailCreationConseillerMilo(
          utilisateurMisAJour
        )
      }
    }

    return utilisateurMisAJour
  }

  private async authentificationJeuneMilo(
    commandSanitized: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurTrouve =
      (await this.authentificationRepository.getJeuneByIdAuthentification(
        commandSanitized.idUtilisateurAuth
      )) ?? (await this.recupererJeuneMiloOrphelinParEmail(commandSanitized))

    if (!utilisateurTrouve) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          NonTraitableReason.UTILISATEUR_INEXISTANT,
          commandSanitized.email
        )
      )
    }
    const verificationProfilUtilisateur = verifierProfilBeneficiaire(
      utilisateurTrouve,
      commandSanitized
    )
    if (isFailure(verificationProfilUtilisateur)) {
      return verificationProfilUtilisateur
    }
    const utilisateurMisAJour = await this.mettreAJourLUtilisateur(
      utilisateurTrouve,
      commandSanitized
    )
    return success(queryModelFromUtilisateur(utilisateurMisAJour))
  }

  // Un jeune Milo désarchivé n'a plus d'idAuthentification : on le retrouve par email, mais jamais un compte déjà lié car l'email keycloak-milo n'est pas vérifié
  private async recupererJeuneMiloOrphelinParEmail(
    command: UpdateUtilisateurCommand
  ): Promise<Authentification.Utilisateur | undefined> {
    if (!command.email) {
      return undefined
    }

    const utilisateurTrouve =
      await this.authentificationRepository.getJeuneByEmail(
        command.email,
        Profil.Structure.MILO
      )
    if (!utilisateurTrouve || utilisateurTrouve.idAuthentification) {
      return undefined
    }

    this.logger.warn(
      `Réassociation par email du jeune Milo ${utilisateurTrouve.id} au nouvel idAuthentification ${command.idUtilisateurAuth}`
    )
    return utilisateurTrouve
  }

  private async authentificationBeneficiaireFT(
    commandSanitized: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurTrouve =
      await this.authentificationRepository.getJeuneByIdAuthentification(
        commandSanitized.idUtilisateurAuth
      )

    if (!utilisateurTrouve) {
      return this.authentifierJeuneParEmail(commandSanitized)
    }
    const verificationUtilisateur = verifierProfilBeneficiaire(
      utilisateurTrouve,
      commandSanitized
    )
    if (isFailure(verificationUtilisateur)) {
      return verificationUtilisateur
    }

    const utilisateurMisAJour = await this.mettreAJourLUtilisateur(
      utilisateurTrouve,
      commandSanitized
    )

    return success(queryModelFromUtilisateur(utilisateurMisAJour))
  }

  private async authentificationBeneficiaireNonAccompagne(
    commandSanitized: UpdateUtilisateurCommand,
    profil: Profil
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurTrouve =
      await this.authentificationRepository.getJeuneByIdAuthentification(
        commandSanitized.idUtilisateurAuth
      )

    if (utilisateurTrouve) {
      const utilisateurMisAJour = await this.mettreAJourLUtilisateur(
        utilisateurTrouve,
        commandSanitized
      )
      return success(queryModelFromUtilisateur(utilisateurMisAJour))
    }

    const nouveauJeune = this.jeuneNonAccompagneFactory.creer({
      prenom: commandSanitized.prenom ?? '',
      nom: commandSanitized.nom ?? '',
      email: commandSanitized.email,
      dispositif: profil.dispositif as DispositifNonAccompagne
    })
    await this.jeuneRepository.save(nouveauJeune)

    const maintenant = this.dateService.nowJs()
    const utilisateur: Authentification.Utilisateur = {
      id: nouveauJeune.id,
      idAuthentification: commandSanitized.idUtilisateurAuth,
      prenom: nouveauJeune.firstName,
      nom: nouveauJeune.lastName,
      email: commandSanitized.email,
      profil: {
        structure: nouveauJeune.structure,
        dispositif: nouveauJeune.dispositif
      },
      type: Authentification.Type.JEUNE,
      roles: [],
      dateDerniereConnexion: maintenant,
      datePremiereConnexion: maintenant
    }
    await this.authentificationRepository.update(utilisateur)

    return success(queryModelFromUtilisateur(utilisateur))
  }

  private async recupererOuCreerUtilisateurConseiller(
    commandSanitized: UpdateUtilisateurCommand,
    profil: Profil
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurTrouve =
      await this.authentificationRepository.getConseiller(
        commandSanitized.idUtilisateurAuth
      )
    if (!utilisateurTrouve) {
      return this.creerNouveauConseiller(commandSanitized, profil)
    }
    if (!memeProfil(profil, utilisateurTrouve.profil)) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          reasonFromProfil(utilisateurTrouve.profil)
        )
      )
    }

    const utilisateurMisAJour = await this.mettreAJourLUtilisateur(
      utilisateurTrouve,
      commandSanitized
    )
    return success(queryModelFromUtilisateur(utilisateurMisAJour))
  }

  private async recupererUtilisateurConseillerExistant(
    commandSanitized: UpdateUtilisateurCommand
  ): Promise<Result<UtilisateurQueryModel>> {
    const utilisateurTrouve =
      await this.authentificationRepository.getConseiller(
        commandSanitized.idUtilisateurAuth
      )
    if (!utilisateurTrouve) {
      return failure(
        new NonTraitableError(
          'Utilisateur',
          commandSanitized.idUtilisateurAuth,
          NonTraitableReason.UTILISATEUR_INEXISTANT
        )
      )
    }

    const utilisateurMisAJour = await this.mettreAJourLUtilisateur(
      utilisateurTrouve,
      commandSanitized
    )
    return success(queryModelFromUtilisateur(utilisateurMisAJour))
  }

  private async lUtilisateurDoitMigrerVersParcoursEmploi(
    utilisateur: UtilisateurQueryModel
  ): Promise<boolean> {
    if (utilisateur.type === Type.SUPPORT) return false

    return await this.migrationService.faitPartieDeLaMigrationEtLaDateEstPassee(
      {
        id: utilisateur.id,
        type: utilisateur.type
      }
    )
  }

  private async lUtilisateurEstArchive(
    email: string | undefined
  ): Promise<boolean> {
    if (!email) return false
    return await this.archiverJeuneRepository.estArchiveAvecMotif(
      email,
      MotifSuppressionSupport.MIGRATION
    )
  }
}

// Le bouton unique FT Connect ne dit pas le dispositif : profil FT sans dispositif.
function profilAttendu(command: UpdateUtilisateurCommand): Profil {
  if (command.structure === 'FRANCE_TRAVAIL') {
    return { structure: Profil.Structure.FRANCE_TRAVAIL, dispositif: null }
  }
  return structureLegacyVersProfil(command.structure)
}

function verifierProfilBeneficiaire(
  utilisateurTrouve: Authentification.Utilisateur,
  command: UpdateUtilisateurCommand
): Result {
  // TODO : ne garder que cette partie pour FT quand le mobile sera en prod avec bouton unique FT
  if (command.structure === 'FRANCE_TRAVAIL') {
    return autoriseUtilisateurFTConnectOnly(
      utilisateurTrouve,
      command.idUtilisateurAuth
    )
  }

  if (!memeProfil(profilAttendu(command), utilisateurTrouve.profil)) {
    return failure(
      new NonTraitableError(
        'Utilisateur',
        command.idUtilisateurAuth,
        reasonFromProfil(utilisateurTrouve.profil)
      )
    )
  }

  return emptySuccess()
}

function autoriseUtilisateurFTConnectOnly(
  utilisateurTrouve: Authentification.Utilisateur,
  idUtilisateur: string
): Result {
  switch (utilisateurTrouve.profil.structure) {
    case Profil.Structure.MILO:
      return failure(
        new NonTraitableError(
          'Utilisateur',
          idUtilisateur,
          NonTraitableReason.UTILISATEUR_DEJA_MILO
        )
      )
    case Profil.Structure.FRANCE_TRAVAIL:
    case Profil.Structure.CONSEIL_DEPARTEMENTAL:
      return emptySuccess()
    case Profil.Structure.INVITE:
      return failure(
        new NonTraitableError(
          'Utilisateur',
          idUtilisateur,
          NonTraitableReason.STRUCTURE_UTILISATEUR_NON_TRAITABLE
        )
      )
  }
}

function reasonFromProfil(profil: Profil): NonTraitableReason {
  switch (profil.structure) {
    case Profil.Structure.MILO:
      return NonTraitableReason.UTILISATEUR_DEJA_MILO
    case Profil.Structure.CONSEIL_DEPARTEMENTAL:
      return NonTraitableReason.UTILISATEUR_DEJA_CONSEIL_DEPT
    case Profil.Structure.INVITE:
      return NonTraitableReason.STRUCTURE_UTILISATEUR_NON_TRAITABLE
    case Profil.Structure.FRANCE_TRAVAIL:
      switch (profil.dispositif) {
        case Profil.Dispositif.CEJ:
          return NonTraitableReason.UTILISATEUR_DEJA_PE
        case Profil.Dispositif.BRSA:
          return NonTraitableReason.UTILISATEUR_DEJA_PE_BRSA
        case Profil.Dispositif.AIJ:
          return NonTraitableReason.UTILISATEUR_DEJA_PE_AIJ
        case Profil.Dispositif.AVENIR_PRO:
          return NonTraitableReason.UTILISATEUR_DEJA_AVENIR_PRO
        case Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF:
          return NonTraitableReason.UTILISATEUR_DEJA_ACCOMPAGNEMENT_INTENSIF
        case Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL:
          return NonTraitableReason.UTILISATEUR_DEJA_ACCOMPAGNEMENT_GLOBAL
        case Profil.Dispositif.EQUIP_EMPLOI_RECRUT:
          return NonTraitableReason.UTILISATEUR_DEJA_EQUIP_EMPLOI_RECRUT
        default:
          return NonTraitableReason.STRUCTURE_UTILISATEUR_NON_TRAITABLE
      }
  }
}

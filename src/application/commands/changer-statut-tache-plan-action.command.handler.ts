import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import {
  DateNonAutoriseeError,
  DroitsInsuffisants,
  MauvaiseCommandeError,
  NonTrouveError,
  RessourceIndisponibleError
} from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../building-blocks/types/result'
import { Action, ActionRepositoryToken } from '../../domain/action/action'
import { Authentification } from '../../domain/authentification'
import { Demarche, DemarcheRepositoryToken } from '../../domain/demarche'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import {
  PlanAction,
  PlanActionRepositoryToken
} from '../../domain/plan-action/plan-action'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { TOUT_PROFIL_SAUF_INVITE } from '../../domain/profil'
import { DateService } from '../../utils/date-service'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'

export interface ChangerStatutTachePlanActionCommand extends Command {
  idJeune: string
  idTache: string
  terminee: boolean
  date?: DateTime
  commentaire?: string
  accessToken: string
}

@Injectable()
export class ChangerStatutTachePlanActionCommandHandler extends CommandHandler<
  ChangerStatutTachePlanActionCommand,
  void,
  PlanAction.Tache
> {
  readonly profilsAutorises = [...TOUT_PROFIL_SAUF_INVITE]

  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    @Inject(PlanActionRepositoryToken)
    private readonly planActionRepository: PlanAction.Repository,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(ActionRepositoryToken)
    private readonly actionRepository: Action.Repository,
    private readonly actionFactory: Action.Factory,
    @Inject(DemarcheRepositoryToken)
    private readonly demarcheRepository: Demarche.Repository,
    private readonly demarcheFactory: Demarche.Factory,
    private readonly evenementService: EvenementService,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super('ChangerStatutTachePlanActionCommandHandler')
  }

  async getAggregate(
    command: ChangerStatutTachePlanActionCommand
  ): Promise<PlanAction.Tache | undefined> {
    return this.planActionRepository.getTache(command.idJeune, command.idTache)
  }

  async authorize(
    command: ChangerStatutTachePlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: ChangerStatutTachePlanActionCommand,
    utilisateur: Authentification.Utilisateur,
    tache?: PlanAction.Tache
  ): Promise<Result> {
    if (!tache) {
      return failure(new NonTrouveError('TachePlanAction', command.idTache))
    }
    if (tache.terminee === command.terminee) {
      return emptySuccess()
    }
    if (!command.terminee) {
      await this.planActionRepository.saveTache(PlanAction.decocherTache(tache))
      return emptySuccess()
    }

    const mode = PlanAction.modeDeclaration(utilisateur.profil)
    if (mode === PlanAction.ModeDeclaration.AUCUNE) {
      await this.planActionRepository.saveTache(
        PlanAction.cocherTache(tache, command.date ?? this.dateService.now())
      )
      return emptySuccess()
    }

    const validation = this.validerDeclaration(command, mode)
    if (isFailure(validation)) {
      return validation
    }
    const date = command.date!

    const [solution] = await this.referentielRepository.trouverSolutions([
      tache.idSolution
    ])
    if (!solution) {
      return failure(
        new RessourceIndisponibleError(
          `La solution ${tache.idSolution} n'est plus proposée`
        )
      )
    }

    const creation =
      mode === PlanAction.ModeDeclaration.ACTION_MILO
        ? await this.creerAction(command, solution, date)
        : await this.creerDemarche(command, solution, date, utilisateur)
    if (isFailure(creation)) {
      return creation
    }

    await this.planActionRepository.saveTache(
      PlanAction.cocherTache(tache, date)
    )
    return emptySuccess()
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: ChangerStatutTachePlanActionCommand,
    tache?: PlanAction.Tache
  ): Promise<void> {
    const aDeclare =
      command.terminee &&
      tache !== undefined &&
      !tache.terminee &&
      PlanAction.modeDeclaration(utilisateur.profil) !==
        PlanAction.ModeDeclaration.AUCUNE
    if (!aDeclare) return

    await this.evenementService.creer(
      Evenement.Code.ACTION_CREEE_PLAN_ACTION,
      utilisateur,
      tache.idSolution
    )
  }

  private validerDeclaration(
    command: ChangerStatutTachePlanActionCommand,
    mode: PlanAction.ModeDeclaration
  ): Result {
    if (!command.date) {
      return failure(
        new MauvaiseCommandeError('La date de réalisation est requise')
      )
    }
    const aujourdhui = this.dateService
      .now()
      .setZone(command.date.zone)
      .startOf('day')
    if (command.date.startOf('day') > aujourdhui) {
      return failure(new DateNonAutoriseeError())
    }
    if (
      mode === PlanAction.ModeDeclaration.ACTION_MILO &&
      !command.commentaire?.trim()
    ) {
      return failure(new MauvaiseCommandeError('Le commentaire est requis'))
    }
    if (
      mode === PlanAction.ModeDeclaration.DEMARCHE_FT &&
      command.commentaire !== undefined
    ) {
      return failure(
        new MauvaiseCommandeError(
          "Le commentaire n'est pas accepté pour une démarche"
        )
      )
    }
    return emptySuccess()
  }

  private async creerAction(
    command: ChangerStatutTachePlanActionCommand,
    solution: ReferentielPlanAction.Solution,
    date: DateTime
  ): Promise<Result> {
    const jeune = await this.jeuneRepository.get(command.idJeune)
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', command.idJeune))
    }

    const action = this.actionFactory.buildAction(
      {
        contenu: solution.libelle,
        idJeune: command.idJeune,
        statut: Action.Statut.TERMINEE,
        commentaire: command.commentaire,
        typeCreateur: Action.TypeCreateur.JEUNE,
        dateEcheance: date,
        rappel: false,
        codeQualification: versCodeQualification(
          solution.conversionML?.codeCategorie
        )
      },
      jeune
    )
    if (isFailure(action)) {
      return action
    }

    await this.actionRepository.save(action.data)
    return emptySuccess()
  }

  private async creerDemarche(
    command: ChangerStatutTachePlanActionCommand,
    solution: ReferentielPlanAction.Solution,
    date: DateTime,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    const demarche = this.demarcheFactory.creerDemarche({
      dateFin: date,
      pourquoi: solution.conversionFT?.codePourquoi,
      quoi: solution.conversionFT?.codeQuoi,
      description: solution.libelle,
      realisee: true
    })
    if (isFailure(demarche)) {
      return demarche
    }

    const resultat = await this.demarcheRepository.save(
      demarche.data,
      command.accessToken,
      utilisateur.profil.structure
    )
    return isFailure(resultat) ? resultat : emptySuccess()
  }
}

function versCodeQualification(
  codeCategorie: string | undefined
): Action.Qualification.Code | undefined {
  return Object.values(Action.Qualification.Code).find(
    code => code === codeCategorie
  )
}

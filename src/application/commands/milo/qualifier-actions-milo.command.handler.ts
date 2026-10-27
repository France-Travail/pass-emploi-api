import { Inject, Injectable } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure,
  success
} from '../../../building-blocks/types/result'
import { Profil, TOUT_MILO } from '../../../domain/profil'
import { Action, ActionRepositoryToken } from '../../../domain/action/action'
import { Qualification } from '../../../domain/action/qualification'
import { Authentification } from '../../../domain/authentification'
import { Evenement, EvenementService } from '../../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import {
  ActionMilo,
  ActionMiloRepositoryToken
} from '../../../domain/milo/action.milo'
import { OidcClient } from '../../../infrastructure/clients/oidc-client.db'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'

export class QualificationActionsMiloQueryModel {
  @ApiProperty({ isArray: true, type: String })
  idsActionsEnErreur: string[]
}

export interface QualifierActionsMiloCommand extends Command {
  estSNP: boolean
  qualifications: Array<{
    idAction: string
    codeQualification: Qualification.Code
  }>
  accessToken: string
}

@Injectable()
export class QualifierActionsMiloCommandHandler extends CommandHandler<
  QualifierActionsMiloCommand,
  QualificationActionsMiloQueryModel,
  Action[]
> {
  readonly profilsAutorises = TOUT_MILO

  constructor(
    @Inject(ActionRepositoryToken)
    private readonly actionRepository: Action.Repository,
    @Inject(ActionMiloRepositoryToken)
    private readonly actionMiloRepository: ActionMilo.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    private readonly evenementService: EvenementService,
    private readonly oidcClient: OidcClient
  ) {
    super('QualifierActionsMiloCommandHandler')
  }

  async getAggregate(command: QualifierActionsMiloCommand): Promise<Action[]> {
    const idsActions = command.qualifications.map(
      qualification => qualification.idAction
    )
    return this.actionRepository.findAll(idsActions)
  }

  async handle(
    command: QualifierActionsMiloCommand,
    utilisateur: Authentification.Utilisateur,
    actions: Action[]
  ): Promise<Result<QualificationActionsMiloQueryModel>> {
    const idsActionsEnErreur: string[] = []
    let idpToken: Promise<string> | undefined
    const getIdpToken = (): Promise<string> =>
      (idpToken ??= this.oidcClient.exchangeToken(
        command.accessToken,
        Profil.Structure.MILO
      ))

    const resultValidationCategories = validaterCategories(command)
    if (isFailure(resultValidationCategories)) {
      return resultValidationCategories
    }

    for (const qualification of command.qualifications) {
      const action = actions.find(
        actionTrouvee => qualification.idAction === actionTrouvee.id
      )

      if (!action) {
        idsActionsEnErreur.push(qualification.idAction)
        continue
      }
      const qualifierResult = Action.qualifier(
        action,
        qualification.codeQualification
      )

      if (isFailure(qualifierResult)) {
        idsActionsEnErreur.push(action.id)
        this.logger.warn(qualifierResult.error.message)
        continue
      }
      const actionQualifiee: Action.Qualifiee = qualifierResult.data

      const estSNP =
        actionQualifiee.qualification.code !== Qualification.Code.NON_SNP

      if (estSNP) {
        const resultQualificationEnSNP = await qualifierEnSNP(
          actionQualifiee,
          utilisateur,
          this.actionMiloRepository,
          this.jeuneRepository,
          getIdpToken
        )
        if (isFailure(resultQualificationEnSNP)) {
          idsActionsEnErreur.push(qualification.idAction)
          this.logger.warn(resultQualificationEnSNP.error.message)
          continue
        }
      }

      await this.actionRepository.save(actionQualifiee)
    }

    return success({
      idsActionsEnErreur
    })
  }

  async authorize(
    _command: QualifierActionsMiloCommand,
    utilisateur: Authentification.Utilisateur,
    actions: Action[]
  ): Promise<Result> {
    const idsJeunes = actions.map(action => action.idJeune)
    return this.conseillerAuthorizer.autoriserConseillerPourSesJeunes(
      idsJeunes,
      utilisateur
    )
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: QualifierActionsMiloCommand
  ): Promise<void> {
    if (command.estSNP) {
      await this.evenementService.creer(
        Evenement.Code.ACTION_QUALIFIEE_MULTIPLE_SNP,
        utilisateur
      )
    } else {
      await this.evenementService.creer(
        Evenement.Code.ACTION_QUALIFIEE_MULTIPLE_NON_SNP,
        utilisateur
      )
    }
  }
}

async function qualifierEnSNP(
  actionQualifiee: Action.Qualifiee,
  utilisateur: Authentification.Utilisateur,
  actionMiloRepository: ActionMilo.Repository,
  jeuneRepository: Jeune.Repository,
  getIdpToken: () => Promise<string>
): Promise<Result> {
  const jeune = await jeuneRepository.get(actionQualifiee.idJeune)
  if (!jeune) {
    return failure(new NonTrouveError('Jeune non trouvé'))
  }

  const actionMiloResult = ActionMilo.creer(actionQualifiee, jeune, utilisateur)

  if (isFailure(actionMiloResult)) {
    return actionMiloResult
  }

  const qualificationResult =
    await actionMiloRepository.creerSituationNonProfessionnelle(
      actionMiloResult.data,
      getIdpToken
    )

  if (isFailure(qualificationResult)) {
    return qualificationResult
  }

  return emptySuccess()
}

function validaterCategories(command: QualifierActionsMiloCommand): Result {
  if (command.estSNP) {
    if (
      command.qualifications.some(
        qualification =>
          qualification.codeQualification === Qualification.Code.NON_SNP
      )
    )
      return failure(
        new MauvaiseCommandeError(
          'Toutes les actions doivent être qualifiées SNP'
        )
      )
  } else {
    if (
      command.qualifications.some(
        qualification =>
          qualification.codeQualification !== Qualification.Code.NON_SNP
      )
    )
      return failure(
        new MauvaiseCommandeError(
          'Toutes les actions doivent être qualifiées non SNP'
        )
      )
  }

  return emptySuccess()
}

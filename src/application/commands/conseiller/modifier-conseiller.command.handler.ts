import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure
} from '../../../building-blocks/types/result'
import { Agence, AgenceRepositoryToken } from '../../../domain/agence'
import { Authentification } from '../../../domain/authentification'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import {
  DISPOSITIFS_ACCOMPAGNES,
  estFranceTravail,
  Profil
} from '../../../domain/profil'
import {
  Conseiller,
  ConseillerRepositoryToken
} from '../../../domain/milo/conseiller'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { DateService } from '../../../utils/date-service'

export interface ModifierConseillerCommand extends Command {
  idConseiller: string
  agence?: Agence
  dispositif?: Profil.Dispositif
  dateSignatureCGU?: string
  dateVisionnageActus?: string
  notificationsSonores?: boolean
}

@Injectable()
export class ModifierConseillerCommandHandler extends CommandHandler<
  ModifierConseillerCommand,
  void
> {
  readonly profilsAutorises = DISPOSITIFS_ACCOMPAGNES

  constructor(
    @Inject(ConseillerRepositoryToken)
    private conseillerRepository: Conseiller.Repository,
    @Inject(AgenceRepositoryToken)
    private agencesRepository: Agence.Repository,
    @Inject(JeuneRepositoryToken)
    private jeuneRepository: Jeune.Repository,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    private readonly dateService: DateService
  ) {
    super('ModifierConseillerCommandHandler')
  }

  async handle(command: ModifierConseillerCommand): Promise<Result> {
    const conseillerActuel = await this.conseillerRepository.get(
      command.idConseiller
    )
    if (!conseillerActuel) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    if (command.agence?.id) {
      const agence = await this.agencesRepository.get(
        command.agence.id,
        conseillerActuel.structure
      )
      if (!agence) {
        return failure(new NonTrouveError('Agence', command.agence.id))
      }
    }

    const conseillerFTReconfirmeSonAgence =
      estFranceTravail(conseillerActuel.structure) &&
      Boolean(command.agence?.id)

    const infosDeMiseAJour: Conseiller.InfosDeMiseAJour = {
      notificationsSonores:
        command.notificationsSonores ?? conseillerActuel.notificationsSonores,
      agence: command.agence ?? conseillerActuel.agence,
      dispositif: command.dispositif,
      dateSignatureCGU: command.dateSignatureCGU
        ? DateTime.fromISO(command.dateSignatureCGU)
        : conseillerActuel.dateSignatureCGU,
      dateVisionnageActus: command.dateVisionnageActus
        ? DateTime.fromISO(command.dateVisionnageActus)
        : conseillerActuel.dateVisionnageActus,
      dateMajAgence: conseillerFTReconfirmeSonAgence
        ? this.dateService.now()
        : conseillerActuel.dateMajAgence
    }

    const conseillerResult = Conseiller.mettreAJour(
      conseillerActuel,
      infosDeMiseAJour
    )

    if (isFailure(conseillerResult)) {
      return conseillerResult
    }
    await this.conseillerRepository.save(conseillerResult.data)

    if (command.dispositif) {
      await this.jeuneRepository.changerDispositifDesJeunesDuConseiller(
        command.idConseiller,
        command.dispositif
      )
    }
    return emptySuccess()
  }

  async authorize(
    query: ModifierConseillerCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      query.idConseiller,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

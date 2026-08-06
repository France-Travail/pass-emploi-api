import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Profil } from '../../../domain/profil'
import { estMilo } from '../../../domain/core'
import { Evenement, EvenementService } from '../../../domain/evenement'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../../building-blocks/types/domain-error'
import { ActualiteMiloSuppresionCommandResult } from '../../queries/query-models/actualites-milo.query-model'
import { DateService } from '../../../utils/date-service'

export interface DeleteActualiteMiloCommand extends Command {
  idActualite: string
  idConseiller: string
}

@Injectable()
export class DeleteActualiteMiloCommandHandler extends CommandHandler<
  DeleteActualiteMiloCommand,
  ActualiteMiloSuppresionCommandResult
> {
  readonly profilsAutorises = [Profil.CONSEILLER]

  constructor(
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    private readonly evenementService: EvenementService
  ) {
    super('DeleteActualiteMiloCommandHandler')
  }

  async authorize(
    command: DeleteActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async handle(
    command: DeleteActualiteMiloCommand
  ): Promise<Result<ActualiteMiloSuppresionCommandResult>> {
    const actualite = await this.actualiteMiloRepository.get(
      command.idActualite
    )
    if (!actualite) {
      return failure(new NonTrouveError('Actualite', command.idActualite))
    }

    if (actualite.idConseiller !== command.idConseiller) {
      return failure(new DroitsInsuffisants())
    }

    const dateSuppression = await this.actualiteMiloRepository.delete(
      command.idActualite
    )

    return success({
      dateSuppression: DateService.fromJSDateToISOString(dateSuppression)
    })
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_SUPPRIMEE,
      utilisateur
    )
  }
}

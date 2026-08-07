import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { failure, Result, success } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Profil } from '../../../domain/profil'
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
import { ActualiteMiloConseillerQueryModel } from '../../queries/query-models/actualites-milo.query-model'

export interface UpdateActualiteMiloCommand extends Command {
  idActualite: string
  idConseiller: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
}

@Injectable()
export class UpdateActualiteMiloCommandHandler extends CommandHandler<
  UpdateActualiteMiloCommand,
  ActualiteMiloConseillerQueryModel
> {
  readonly profilsAutorises = [Profil.Conseiller.MILO]

  constructor(
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    private readonly actualiteMiloFactory: ActualiteMilo.Factory,
    private readonly evenementService: EvenementService
  ) {
    super('UpdateActualiteMiloCommandHandler')
  }

  async authorize(
    command: UpdateActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur
    )
  }

  async handle(
    command: UpdateActualiteMiloCommand
  ): Promise<Result<ActualiteMiloConseillerQueryModel>> {
    const actualite = await this.actualiteMiloRepository.get(
      command.idActualite
    )
    if (!actualite) {
      return failure(new NonTrouveError('Actualite', command.idActualite))
    }

    if (actualite.idConseiller !== command.idConseiller) {
      return failure(new DroitsInsuffisants())
    }

    const actualiteMiseAJour = this.actualiteMiloFactory.modifier(actualite, {
      titre: command.titre,
      contenu: command.contenu,
      titreLien: command.titreLien,
      lien: command.lien
    })

    await this.actualiteMiloRepository.save(actualiteMiseAJour)

    return success({
      id: actualiteMiseAJour.id,
      titre: actualiteMiseAJour.titre,
      contenu: actualiteMiseAJour.contenu,
      titreLien: actualiteMiseAJour.titreLien,
      lien: actualiteMiseAJour.lien,
      prenomNomConseiller: actualiteMiseAJour.prenomNomConseiller,
      dateCreation: actualiteMiseAJour.dateCreation.toISO(),
      dateModification: actualiteMiseAJour.dateModification?.toISO(),
      proprietaire: true
    })
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_MODIFIEE,
      utilisateur
    )
  }
}

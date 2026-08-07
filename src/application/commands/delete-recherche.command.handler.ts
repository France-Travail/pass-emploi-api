import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { PROFILS_JEUNES_ACCOMPAGNES } from '../../domain/profil'
import {
  Recherche,
  RecherchesRepositoryToken
} from '../../domain/offre/recherche/recherche'
import { RechercheAuthorizer } from '../authorizers/recherche-authorizer'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../building-blocks/types/domain-error'
import { Evenement, EvenementService } from '../../domain/evenement'

export interface DeleteRechercheCommand extends Command {
  idJeune: string
  idRecherche: string
}

@Injectable()
export class DeleteRechercheCommandHandler extends CommandHandler<
  DeleteRechercheCommand,
  void
> {
  readonly profilsAutorises = PROFILS_JEUNES_ACCOMPAGNES

  constructor(
    @Inject(RecherchesRepositoryToken)
    private readonly rechercheRepository: Recherche.Repository,
    private readonly rechercheAuthorizer: RechercheAuthorizer,
    private readonly evenementService: EvenementService
  ) {
    super('DeleteRechercheCommandHandler')
  }

  async handle(command: DeleteRechercheCommand): Promise<Result> {
    const rechercheExistante = await this.rechercheRepository.existe(
      command.idRecherche,
      command.idJeune
    )
    if (!rechercheExistante) {
      return failure(new NonTrouveError('Recherche', command.idRecherche))
    }
    await this.rechercheRepository.delete(command.idRecherche)
    return emptySuccess()
  }

  async authorize(
    command: DeleteRechercheCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.rechercheAuthorizer.autoriserLeJeunePourSaRecherche(
      command.idJeune,
      command.idRecherche,
      utilisateur
    )
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: DeleteRechercheCommand
  ): Promise<void> {
    const recherche = await this.rechercheRepository.get(command.idRecherche)

    if (!recherche) {
      throw failure(new MauvaiseCommandeError('Recherche non trouvée'))
    }

    switch (recherche.type) {
      case Recherche.Type.OFFRES_EMPLOI:
        await this.evenementService.creer(
          Evenement.Code.RECHERCHE_EMPLOI_SUPPRIMEE,
          utilisateur
        )
        break
      case Recherche.Type.OFFRES_ALTERNANCE:
        await this.evenementService.creer(
          Evenement.Code.RECHERCHE_ALTERNANCE_SUPPRIMEE,
          utilisateur
        )
        break
      case Recherche.Type.OFFRES_IMMERSION:
        await this.evenementService.creer(
          Evenement.Code.RECHERCHE_IMMERSION_SUPPRIMEE,
          utilisateur
        )
        break
      case Recherche.Type.OFFRES_SERVICES_CIVIQUE:
        await this.evenementService.creer(
          Evenement.Code.RECHERCHE_SERVICE_CIVIQUE_SUPPRIMEE,
          utilisateur
        )
        break
    }
  }
}

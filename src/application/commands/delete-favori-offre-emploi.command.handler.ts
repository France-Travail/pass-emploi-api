import { Inject, Injectable } from '@nestjs/common'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
import { FavorisOffresEmploiRepositoryToken } from '../../domain/offre/favori/offre-emploi'
import { FavoriOffresEmploiAuthorizer } from '../authorizers/favori-offres-emploi-authorizer'
import { Offre } from '../../domain/offre/offre'

export interface DeleteFavoriOffreEmploiCommand extends Command {
  idOffreEmploi: string
  idJeune: string
}

@Injectable()
export class DeleteFavoriOffreEmploiCommandHandler extends CommandHandler<
  DeleteFavoriOffreEmploiCommand,
  void
> {
  readonly profilsAutorises = [
    Profil.MILO,
    Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.FT_DEMANDEUR_EMPLOI,
    Profil.CONSEIL_DEPT
  ]

  constructor(
    @Inject(FavorisOffresEmploiRepositoryToken)
    private readonly offresEmploiRepository: Offre.Favori.Emploi.Repository,
    private readonly favoriOffresEmploiAuthorizer: FavoriOffresEmploiAuthorizer
  ) {
    super('DeleteFavoriCommandHandler')
  }

  async handle(command: DeleteFavoriOffreEmploiCommand): Promise<Result<void>> {
    const favoriOffreEmploi = await this.offresEmploiRepository.get(
      command.idJeune,
      command.idOffreEmploi
    )
    if (!favoriOffreEmploi) {
      return failure(
        new NonTrouveError(
          'Favori',
          `du jeune ${command.idJeune} correspondant à l'offre ${command.idOffreEmploi}`
        )
      )
    }
    await this.offresEmploiRepository.delete(
      command.idJeune,
      command.idOffreEmploi
    )
    return emptySuccess()
  }

  async authorize(
    command: DeleteFavoriOffreEmploiCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.favoriOffresEmploiAuthorizer.autoriserLeJeunePourSonOffre(
      command.idJeune,
      command.idOffreEmploi,
      utilisateur
    )
  }

  async monitor(): Promise<void> {
    return
  }
}

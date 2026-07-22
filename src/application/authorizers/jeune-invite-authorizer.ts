import { Inject, Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/core'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'

@Injectable()
export class JeuneInviteAuthorizer {
  constructor(
    @Inject(JeuneInviteRepositoryToken)
    private jeuneInviteRepository: JeuneInvite.Repository
  ) {}

  async autoriserLInvite(
    idJeune: string,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (
      Authentification.estJeune(utilisateur.type) &&
      estInvite(utilisateur.structure) &&
      utilisateur.id === idJeune
    ) {
      const existe = await this.jeuneInviteRepository.existe(idJeune)
      if (existe) {
        return emptySuccess()
      }
    }

    return failure(new DroitsInsuffisants())
  }
}

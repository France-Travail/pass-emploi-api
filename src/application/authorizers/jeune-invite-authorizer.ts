import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'

@Injectable()
export class JeuneInviteAuthorizer {
  constructor(
    @Inject(JeuneInviteRepositoryToken)
    private jeuneInviteRepository: JeuneInvite.Repository,
    private configService: ConfigService
  ) {}

  async autoriserLInvite(
    idJeune: string,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (!this.configService.get<boolean>('appJeuneActif')) {
      return failure(new DroitsInsuffisants())
    }

    const existe = await this.jeuneInviteRepository.existe(idJeune)
    if (existe && utilisateur.id === idJeune) {
      return emptySuccess()
    }

    return failure(new DroitsInsuffisants())
  }
}

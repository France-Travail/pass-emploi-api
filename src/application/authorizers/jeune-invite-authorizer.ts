import { Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/core'
import { JeuneInviteSqlModel } from '../../infrastructure/sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteAuthorizer {
  /**
   * N'autorise que les invités, et uniquement sur leurs propres données.
   *
   * Le contrôle d'existence en base n'est pas redondant avec le JWT : le token
   * d'un invité n'expirant jamais, un compte purgé conserverait un token
   * valide. C'est ce contrôle qui l'arrête.
   */
  async autoriserLInvite(
    idJeune: string,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    if (
      Authentification.estJeune(utilisateur.type) &&
      estInvite(utilisateur.structure) &&
      utilisateur.id === idJeune
    ) {
      const jeuneInvite = await JeuneInviteSqlModel.findByPk(idJeune)
      if (jeuneInvite) {
        return emptySuccess()
      }
    }

    return failure(new DroitsInsuffisants())
  }
}

import { ConfigService } from '@nestjs/config'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import {
  failure,
  emptySuccess
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { JeuneInviteSqlRepository } from '../../../src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db'
import { JeuneInviteSqlModel } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unJeuneInviteDto } from '../../fixtures/sql-models/jeune-invite.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { expect } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import { testConfig } from '../../utils/module-for-testing'
import { unProfilInvite } from '../../fixtures/profil.fixture'

describe('JeuneInviteAuthorizer', () => {
  let jeuneInviteAuthorizer: JeuneInviteAuthorizer

  const idInvite = 'un-invite'
  const unInvite = (
    args: Partial<Authentification.Utilisateur> = {}
  ): Authentification.Utilisateur =>
    unUtilisateurJeune({
      id: idInvite,
      profil: unProfilInvite(),
      ...args
    })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneInviteAuthorizer = new JeuneInviteAuthorizer(
      new JeuneInviteSqlRepository(),
      testConfig()
    )
    await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: idInvite }))
  })

  describe('autoriserLInvite', () => {
    it("rejette l'invité quand le mode app jeune est désactivé", async () => {
      // Given
      const authorizerDesactive = new JeuneInviteAuthorizer(
        new JeuneInviteSqlRepository(),
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const result = await authorizerDesactive.autoriserLInvite(
        idInvite,
        unInvite()
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it('autorise un invité sur ses propres données', async () => {
      // When
      const result = await jeuneInviteAuthorizer.autoriserLInvite(
        idInvite,
        unInvite()
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('rejette un invité qui vise les données d’un autre invité', async () => {
      // When
      const result = await jeuneInviteAuthorizer.autoriserLInvite(
        'un-autre-invite',
        unInvite()
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it('rejette un invité purgé de la base malgré un token encore valide', async () => {
      // Given : le token de l'invité n'expirant jamais, il survit à la purge
      await JeuneInviteSqlModel.destroy({ where: { id: idInvite } })

      // When
      const result = await jeuneInviteAuthorizer.autoriserLInvite(
        idInvite,
        unInvite()
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})

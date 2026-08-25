import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { UpdatePrenomInviteCommandHandler } from '../../../src/application/commands/update-prenom-invite.command.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess
} from '../../../src/building-blocks/types/result'
import { JeuneInviteSqlModel } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unJeuneInviteDto } from '../../fixtures/sql-models/jeune-invite.sql-model'
import { StubbedClass, expect, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import { unProfilInvite } from '../../fixtures/profil.fixture'

describe('UpdatePrenomInviteCommandHandler', () => {
  let updatePrenomInviteCommandHandler: UpdatePrenomInviteCommandHandler
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  const idInvite = 'un-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    updatePrenomInviteCommandHandler = new UpdatePrenomInviteCommandHandler(
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it('met à jour le prénom en base', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: idInvite, prenom: 'Invité' })
      )

      // When
      const result = await updatePrenomInviteCommandHandler.handle({
        idJeune: idInvite,
        prenom: 'Malek'
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      const enBase = await JeuneInviteSqlModel.findByPk(idInvite)
      expect(enBase!.prenom).to.equal('Malek')
    })

    it('échoue quand l’invité n’existe pas', async () => {
      // When
      const result = await updatePrenomInviteCommandHandler.handle({
        idJeune: 'inconnu',
        prenom: 'Malek'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune invité', 'inconnu'))
      )
    })
  })

  describe('authorize', () => {
    it('délègue à JeuneInviteAuthorizer', async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite.resolves(emptySuccess())

      // When
      const result = await updatePrenomInviteCommandHandler.authorize(
        { idJeune: idInvite, prenom: 'Malek' },
        utilisateur
      )

      // Then
      expect(
        jeuneInviteAuthorizer.autoriserLInvite
      ).to.have.been.calledOnceWithExactly(idInvite, utilisateur)
      expect(isSuccess(result)).to.equal(true)
    })
  })
})

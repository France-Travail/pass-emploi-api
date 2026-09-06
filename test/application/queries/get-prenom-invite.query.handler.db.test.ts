import { StubbedClass, expect, stubClass } from '../../utils'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { GetPrenomInviteQueryHandler } from '../../../src/application/queries/get-prenom-invite.query.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { JeuneInviteSqlModel } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unJeuneInviteDto } from '../../fixtures/sql-models/jeune-invite.sql-model'
import { getDatabase } from '../../utils/database-for-testing'
import { unProfilInvite } from '../../fixtures/profil.fixture'

describe('GetPrenomInviteQueryHandler', () => {
  let getPrenomInviteQueryHandler: GetPrenomInviteQueryHandler
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  const idInvite = 'un-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    getPrenomInviteQueryHandler = new GetPrenomInviteQueryHandler(
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it('retourne le prénom de l’invité', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: idInvite, prenom: 'Malek' })
      )

      // When
      const result = await getPrenomInviteQueryHandler.handle({
        idJeune: idInvite
      })

      // Then
      expect(result).to.deep.equal(success({ prenom: 'Malek' }))
    })

    it('échoue quand l’invité n’existe pas', async () => {
      // When
      const result = await getPrenomInviteQueryHandler.handle({
        idJeune: 'inconnu'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
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
      const result = await getPrenomInviteQueryHandler.authorize(
        { idJeune: idInvite },
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

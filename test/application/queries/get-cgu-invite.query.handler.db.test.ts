import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { GetCGUInviteQueryHandler } from '../../../src/application/queries/get-cgu-invite.query.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { JeuneInviteSqlModel } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { unJeuneInviteDto } from '../../fixtures/sql-models/jeune-invite.sql-model'
import { StubbedClass, expect, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetCGUInviteQueryHandler', () => {
  let getCGUInviteQueryHandler: GetCGUInviteQueryHandler
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  const idInvite = 'un-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    getCGUInviteQueryHandler = new GetCGUInviteQueryHandler(
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it("renvoie la date de signature des CGU de l'invité", async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: idInvite,
          dateSignatureCGU: new Date('2026-10-10T12:00:00.000Z')
        })
      )

      // When
      const result = await getCGUInviteQueryHandler.handle({
        idJeune: idInvite
      })

      // Then
      expect(result).to.deep.equal(
        success({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' })
      )
    })

    it("ne renvoie pas de date quand l'invité n'a pas signé les CGU", async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: idInvite, dateSignatureCGU: null })
      )

      // When
      const result = await getCGUInviteQueryHandler.handle({
        idJeune: idInvite
      })

      // Then
      expect(result).to.deep.equal(success({ dateSignatureCGU: undefined }))
    })

    it("échoue quand l'invité n'existe pas", async () => {
      // When
      const result = await getCGUInviteQueryHandler.handle({
        idJeune: 'inconnu'
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
      const result = await getCGUInviteQueryHandler.authorize(
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

  describe('profilsAutorises', () => {
    it('autorise uniquement les invités', () => {
      // Then
      expect(getCGUInviteQueryHandler.profilsAutorises).to.deep.equal(
        TOUT_INVITE
      )
    })
  })
})

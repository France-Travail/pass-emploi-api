import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { UpdateCGUInviteCommandHandler } from '../../../src/application/commands/update-cgu-invite.command.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess
} from '../../../src/building-blocks/types/result'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { JeuneInviteSqlModel } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { unJeuneInviteDto } from '../../fixtures/sql-models/jeune-invite.sql-model'
import { StubbedClass, expect, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('UpdateCGUInviteCommandHandler', () => {
  let updateCGUInviteCommandHandler: UpdateCGUInviteCommandHandler
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  const idInvite = 'un-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    updateCGUInviteCommandHandler = new UpdateCGUInviteCommandHandler(
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it('enregistre la date de signature des CGU en base', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: idInvite, dateSignatureCGU: null })
      )

      // When
      const result = await updateCGUInviteCommandHandler.handle({
        idJeune: idInvite,
        dateSignatureCGU: '2026-10-10T12:00:00.000Z'
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      const enBase = await JeuneInviteSqlModel.findByPk(idInvite)
      expect(enBase!.dateSignatureCGU).to.deep.equal(
        new Date('2026-10-10T12:00:00.000Z')
      )
    })

    it("échoue quand l'invité n'existe pas", async () => {
      // When
      const result = await updateCGUInviteCommandHandler.handle({
        idJeune: 'inconnu',
        dateSignatureCGU: '2026-10-10T12:00:00.000Z'
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
      const result = await updateCGUInviteCommandHandler.authorize(
        { idJeune: idInvite, dateSignatureCGU: '2026-10-10T12:00:00.000Z' },
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
      expect(updateCGUInviteCommandHandler.profilsAutorises).to.deep.equal(
        TOUT_INVITE
      )
    })
  })
})

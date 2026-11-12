import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { UpdateCGUInviteCommandHandler } from '../../../src/application/commands/update-cgu-invite.command.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess
} from '../../../src/building-blocks/types/result'
import { JeuneInvite } from '../../../src/domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'

describe('UpdateCGUInviteCommandHandler', () => {
  let updateCGUInviteCommandHandler: UpdateCGUInviteCommandHandler
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  const idInvite = 'un-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneInviteRepository = stubInterface(sandbox)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    updateCGUInviteCommandHandler = new UpdateCGUInviteCommandHandler(
      jeuneInviteRepository,
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it("signe les CGU à l'instant fourni, quel que soit son fuseau", async () => {
      // Given
      jeuneInviteRepository.signerCGU.resolves(true)

      // When
      const result = await updateCGUInviteCommandHandler.handle({
        idJeune: idInvite,
        dateSignatureCGU: '2026-10-10T14:00:00.000+02:00'
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(jeuneInviteRepository.signerCGU).to.have.been.calledOnce()
      const [id, dateSignature] = jeuneInviteRepository.signerCGU.firstCall.args
      expect(id).to.equal(idInvite)
      expect(dateSignature.toMillis()).to.equal(
        DateTime.fromISO('2026-10-10T12:00:00.000Z').toMillis()
      )
    })

    it("échoue quand l'invité n'existe pas", async () => {
      // Given
      jeuneInviteRepository.signerCGU.resolves(false)

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

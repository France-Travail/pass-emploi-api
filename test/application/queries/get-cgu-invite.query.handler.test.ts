import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { GetCGUInviteQueryHandler } from '../../../src/application/queries/get-cgu-invite.query.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { JeuneInvite } from '../../../src/domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'

describe('GetCGUInviteQueryHandler', () => {
  let getCGUInviteQueryHandler: GetCGUInviteQueryHandler
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
    getCGUInviteQueryHandler = new GetCGUInviteQueryHandler(
      jeuneInviteRepository,
      jeuneInviteAuthorizer
    )
  })

  describe('handle', () => {
    it("renvoie la date de signature des CGU de l'invité", async () => {
      // Given
      jeuneInviteRepository.recupererCGU.withArgs(idInvite).resolves({
        dateSignature: DateTime.fromISO('2026-10-10T14:00:00.000+02:00', {
          setZone: true
        })
      })

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
      jeuneInviteRepository.recupererCGU.withArgs(idInvite).resolves({})

      // When
      const result = await getCGUInviteQueryHandler.handle({
        idJeune: idInvite
      })

      // Then
      expect(result).to.deep.equal(success({ dateSignatureCGU: undefined }))
    })

    it("échoue quand l'invité n'existe pas", async () => {
      // Given
      jeuneInviteRepository.recupererCGU.withArgs('inconnu').resolves(undefined)

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

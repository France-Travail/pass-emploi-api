import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetCGUJeuneQueryHandler } from '../../../src/application/queries/get-cgu-jeune.query.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('GetCGUJeuneQueryHandler', () => {
  let getCGUJeuneQueryHandler: GetCGUJeuneQueryHandler
  let jeuneRepository: StubbedType<Jeune.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>

  beforeEach(() => {
    jeuneRepository = stubInterface(createSandbox())
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    getCGUJeuneQueryHandler = new GetCGUJeuneQueryHandler(
      jeuneRepository,
      jeuneAuthorizer
    )
  })

  describe('authorize', () => {
    it('autorise le jeune', async () => {
      // Given
      const utilisateur = unUtilisateurJeune()

      // When
      await getCGUJeuneQueryHandler.authorize(
        { idJeune: 'idDeJohn' },
        utilisateur
      )

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        'idDeJohn',
        utilisateur
      )
    })
  })

  describe('handle', () => {
    it('renvoie la date de signature des CGU en UTC', async () => {
      // Given
      jeuneRepository.get.withArgs('idDeJohn').resolves(
        unJeune({
          dateSignatureCGU: DateTime.fromISO('2026-10-10T14:00:00.000+02:00', {
            setZone: true
          })
        })
      )

      // When
      const result = await getCGUJeuneQueryHandler.handle({
        idJeune: 'idDeJohn'
      })

      // Then
      expect(result).to.deep.equal(
        success({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' })
      )
    })

    it("ne renvoie pas de date quand le jeune n'a pas signé les CGU", async () => {
      // Given
      jeuneRepository.get
        .withArgs('idDeJohn')
        .resolves(unJeune({ dateSignatureCGU: undefined }))

      // When
      const result = await getCGUJeuneQueryHandler.handle({
        idJeune: 'idDeJohn'
      })

      // Then
      expect(result).to.deep.equal(success({ dateSignatureCGU: undefined }))
    })

    it("renvoie une erreur quand le jeune n'existe pas", async () => {
      // Given
      jeuneRepository.get.withArgs('idDeJohn').resolves(undefined)

      // When
      const result = await getCGUJeuneQueryHandler.handle({
        idJeune: 'idDeJohn'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune', 'idDeJohn'))
      )
    })
  })

  describe('profilsAutorises', () => {
    it('autorise tous les jeunes, accompagnés ou non, sauf les invités', () => {
      // Then
      expect(getCGUJeuneQueryHandler.profilsAutorises).to.deep.equal(
        TOUT_PROFIL_SAUF_INVITE
      )
    })
  })
})

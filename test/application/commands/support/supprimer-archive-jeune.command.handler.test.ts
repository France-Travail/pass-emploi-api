import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  SupprimerArchiveJeuneCommand,
  SupprimerArchiveJeuneCommandHandler
} from '../../../../src/application/commands/support/supprimer-archive-jeune.command.handler'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { unUtilisateurSupport } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('SupprimerArchiveJeuneCommandHandler', () => {
  let handler: SupprimerArchiveJeuneCommandHandler
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let supportAuthorizer: StubbedClass<SupportAuthorizer>

  beforeEach(() => {
    const sandbox = createSandbox()
    archiveJeuneRepository = stubInterface<ArchiveJeune.Repository>(sandbox)
    supportAuthorizer = stubClass(SupportAuthorizer)
    handler = new SupprimerArchiveJeuneCommandHandler(
      archiveJeuneRepository,
      supportAuthorizer
    )
  })

  describe('authorize', () => {
    it('autorise un membre du support', () => {
      // Given
      const command: SupprimerArchiveJeuneCommand = { idArchive: 1 }

      // When
      handler.authorize(command, unUtilisateurSupport())

      // Then
      expect(supportAuthorizer.autoriserSupport).to.have.been.calledWithExactly(
        unUtilisateurSupport()
      )
    })
  })

  describe('handle', () => {
    describe("quand l'archive existe", () => {
      it("supprime l'archive et retourne un succès", async () => {
        // Given
        const command: SupprimerArchiveJeuneCommand = { idArchive: 42 }
        archiveJeuneRepository.findById.resolves(true)
        archiveJeuneRepository.delete.resolves()

        // When
        const result = await handler.handle(command)

        // Then
        expect(
          archiveJeuneRepository.delete
        ).to.have.been.calledOnceWithExactly(42)
        expect(result).to.deep.equal(emptySuccess())
      })
    })

    describe("quand l'archive n'existe pas", () => {
      it('retourne une NonTrouveError', async () => {
        // Given
        const command: SupprimerArchiveJeuneCommand = { idArchive: 999 }
        archiveJeuneRepository.findById.resolves(false)

        // When
        const result = await handler.handle(command)

        // Then
        expect(archiveJeuneRepository.delete).not.to.have.been.called()
        expect(result).to.deep.equal(
          failure(new NonTrouveError('ArchiveJeune', '999'))
        )
      })
    })
  })
})

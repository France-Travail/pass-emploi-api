import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import {
  CreerSuperviseursCommand,
  CreerSuperviseursCommandHandler
} from 'src/application/commands/support/creer-superviseurs.command.handler'
import { Superviseur } from 'src/domain/superviseur'
import { emptySuccess } from '../../../../src/building-blocks/types/result'
import { createSandbox, expect } from '../../../utils'

describe('CreerSuperviseursCommandHandler', () => {
  let creerSuperviseursCommandHandler: CreerSuperviseursCommandHandler
  let superviseurRepository: StubbedType<Superviseur.Repository>

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    superviseurRepository = stubInterface(sandbox)

    creerSuperviseursCommandHandler = new CreerSuperviseursCommandHandler(
      superviseurRepository
    )
  })

  describe('handle', () => {
    describe('quand on veut enregistrer une liste de superviseurs', () => {
      it('retourne un succes', async () => {
        // Given
        const command: CreerSuperviseursCommand = {
          emails: ['test', 'test2']
        }

        superviseurRepository.saveSuperviseurs
          .withArgs(command.emails)
          .resolves(emptySuccess())

        // When
        const result = await creerSuperviseursCommandHandler.handle(command)

        // Then
        expect(superviseurRepository.saveSuperviseurs).to.have.callCount(1)
        expect(result._isSuccess).to.equal(true)
      })
    })
  })
})

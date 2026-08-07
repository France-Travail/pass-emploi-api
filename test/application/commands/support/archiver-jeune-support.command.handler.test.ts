import { stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  ArchiverJeuneSupportCommand,
  ArchiverJeuneSupportCommandHandler
} from '../../../../src/application/commands/support/archiver-jeune-support.command.handler'
import { emptySuccess } from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { expect, stubClass } from '../../../utils'
import { DateService } from '../../../../src/utils/date-service'
import { Mail } from '../../../../src/domain/mail'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { Chat } from '../../../../src/domain/chat'
import { Authentification } from '../../../../src/domain/authentification'
import Service = ArchiveJeune.Service

describe('ArchiverJeuneSupportCommandHandler', () => {
  let archiverJeuneSupportCommandHandler: ArchiverJeuneSupportCommandHandler
  let serviceMock: Service

  const maintenant = new Date('2022-03-01T03:24:00Z')

  beforeEach(() => {
    const sandbox = createSandbox()

    const jeuneRepositoryStub = stubInterface<Jeune.Repository>(sandbox)
    const archiveJeuneRepositoryStub =
      stubInterface<ArchiveJeune.Repository>(sandbox)
    const chatRepositoryStub = stubInterface<Chat.Repository>(sandbox)
    const authentificationRepositoryStub =
      stubInterface<Authentification.Repository>(sandbox)
    const dateService = stubClass(DateService)
    const mailService = stubInterface<Mail.Service>(sandbox)

    serviceMock = {
      jeuneRepository: jeuneRepositoryStub,
      archiveJeuneRepository: archiveJeuneRepositoryStub,
      chatRepository: chatRepositoryStub,
      authentificationRepository: authentificationRepositoryStub,
      dateService: dateService.nowJs.returns(maintenant),
      mailService: mailService,

      archiver: sandbox.stub().resolves(emptySuccess())
    } as unknown as Service

    archiverJeuneSupportCommandHandler = new ArchiverJeuneSupportCommandHandler(
      serviceMock
    )
  })

  describe('authorize', () => {
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result = await archiverJeuneSupportCommandHandler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    describe('quand le jeune existe', () => {
      const command: ArchiverJeuneSupportCommand = {
        idJeune: 'idJeune'
      }

      it('archive le jeune', async () => {
        // Given

        // When
        const result = await archiverJeuneSupportCommandHandler.handle(command)

        // Then
        expect(result).to.deep.equal(emptySuccess())
      })
    })
  })
})

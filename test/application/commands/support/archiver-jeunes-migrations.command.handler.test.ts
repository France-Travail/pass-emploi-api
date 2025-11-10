import { stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import { ArchiverJeuneSupportCommand } from '../../../../src/application/commands/support/archiver-jeune-support.command.handler'
import { emptySuccess } from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { unUtilisateurSupport } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { DateService } from '../../../../src/utils/date-service'
import { Mail } from '../../../../src/domain/mail'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { Chat } from '../../../../src/domain/chat'
import { Authentification } from '../../../../src/domain/authentification'
import { ArchiverJeunesMigrationCommandHandler } from '../../../../src/application/commands/archiver-jeunes-migrations.command.handler'
import { FeatureFlip } from '../../../../src/domain/feature-flip'
import { EvenementService } from '../../../../src/domain/evenement'
import Service = ArchiveJeune.Service

describe('ArchiverJeunesMigrationCommandHandler', () => {
  let archiverJeunesMigrationSupportCommandHandler: ArchiverJeunesMigrationCommandHandler
  let serviceMock: Service
  let authorizeSupport: StubbedClass<SupportAuthorizer>
  let featureFlipService: StubbedClass<FeatureFlip.Service>
  let evenementService: StubbedClass<EvenementService>

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

    authorizeSupport = stubClass(SupportAuthorizer)
    featureFlipService = stubClass(FeatureFlip.Service)
    evenementService = stubClass(EvenementService)
    archiverJeunesMigrationSupportCommandHandler =
      new ArchiverJeunesMigrationCommandHandler(
        evenementService,
        authorizeSupport,
        featureFlipService,
        serviceMock
      )
  })

  describe('authorize', () => {
    it('autorise un membre du support à acceder au handler', () => {
      // Given
      const command: ArchiverJeuneSupportCommand = {
        idJeune: 'idJeune'
      }
      // When
      archiverJeunesMigrationSupportCommandHandler.authorize(
        command,
        unUtilisateurSupport()
      )

      // Then
      expect(authorizeSupport.autoriserSupport).to.have.been.calledWithExactly(
        unUtilisateurSupport()
      )
    })
  })

  describe('handle', () => {
    describe('quand le jeune existe', () => {
      it('archive le jeune', async () => {
        // Given
        const idJeunes = ['1', '2', '3']
        featureFlipService.recupererIdDesBeneficiaireAMigrer.resolves(idJeunes)

        // When
        const result =
          await archiverJeunesMigrationSupportCommandHandler.handle()

        // Then
        expect(result).to.deep.equal(emptySuccess())
      })
    })
  })
})
